import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";

/* ========= Utilities ========= */
const todayUK = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
const parseUK = (s) => {
  if (!s) return new Date(NaN);
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a, b) => {
  const MS = 86400000;
  const a0 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const b0 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((b0 - a0) / MS);
};
const clampNonNegative = (n) => (n < 0 ? 0 : n);
const money = (n) => Number(n || 0).toFixed(2);
const safe = (s) => (s || "").replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "");

/* ========= Profile storage ========= */
const DEFAULT_PROFILE = {
  companyName: "Your Business",
  address: "1 High Street\nTown\nAB1 2CD",
  bank: "12345678",
  sortCode: "00-00-00",
  logo: null,
  vatRate: 20, // %
  vatNumber: "", // optional
};
const loadProfile = () => {
  try {
    const p = JSON.parse(localStorage.getItem("profile") || "{}");
    return { ...DEFAULT_PROFILE, ...p };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
};
function saveProfile(patch) {
  const curr = loadProfile();
  const next = { ...curr, ...patch };
  localStorage.setItem("profile", JSON.stringify(next));
  return next;
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function scaleImageDataURL(dataURL, targetWidth = 300) {
  const img = new Image();
  img.src = dataURL;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });
  const ratio = img.width ? targetWidth / img.width : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/* ========= PDF builders ========= */
function buildInvoicePDF(inv) {
  const profile = loadProfile();
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (profile.logo) {
    try { doc.addImage(profile.logo, "PNG", pageW - 60, 10, 50, 20); } catch {}
  }
  doc.setFontSize(18); doc.text(profile.companyName, 20, 20);
  if (profile.address) {
    doc.setFontSize(10);
    profile.address.split("\n").forEach((line, i) => doc.text(line, 20, 28 + i * 5));
  }
  if (profile.vatNumber) { doc.text(`VAT No: ${profile.vatNumber}`, 20, 45); }
  doc.setFontSize(16); doc.text("Invoice", 20, 54);

  doc.setFont(undefined, "bold"); doc.setFontSize(12);
  doc.text(`Invoice No: INV-${inv.number}`, 20, 68);
  doc.setFont(undefined, "normal");
  doc.text(`Date: ${inv.date}`, 20, 76);
  doc.text(`Client: ${inv.client}`, 20, 91);
  if (inv.email) doc.text(`Email: ${inv.email}`, 20, 99);

  const y0 = 114;
  doc.setFont(undefined, "bold"); doc.text("Amount", 20, y0);
  doc.setFont(undefined, "normal");
  doc.text(`Subtotal: £${money(inv.amount)}`, 20, y0 + 8);
  if (inv.applyVAT) {
    doc.text(`VAT (${loadProfile().vatRate}%): £${money(inv.vatAmount)}`, 20, y0 + 16);
  }
  doc.setFont(undefined, "bold");
  doc.text(`Total: £${money(inv.total)}`, 20, y0 + (inv.applyVAT ? 24 : 16));
  doc.setFont(undefined, "normal");
  doc.text(`Status: ${inv.status}`, 20, y0 + (inv.applyVAT ? 32 : 24));

  if (inv.description) {
    doc.setFont(undefined, "bold");
    doc.text("Goods / Services Supplied:", 20, y0 + (inv.applyVAT ? 44 : 36));
    doc.setFont(undefined, "normal");
    const wrapped = doc.splitTextToSize(inv.description, 170);
    doc.text(wrapped, 20, y0 + (inv.applyVAT ? 52 : 44));
  }

  const addFooter = () => {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(`Bank Account: ${profile.bank}  |  Sort Code: ${profile.sortCode}`, 20, pageH - 18);
    doc.setFont(undefined, "normal");
    doc.text("Thank you for your custom.", 20, pageH - 10);
  };
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); addFooter(); }

  const fileName = `Invoice_INV-${inv.number}_${safe(profile.companyName)}.pdf`;
  return { save: () => doc.save(fileName), toBase64: () => doc.output("datauristring").split(",")[1], fileName };
}
function buildReceiptPDF(inv) {
  const profile = loadProfile();
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (profile.logo) {
    try { doc.addImage(profile.logo, "PNG", pageW - 60, 10, 50, 20); } catch {}
  }
  doc.setFontSize(18); doc.text(profile.companyName, 20, 20);
  if (profile.vatNumber) { doc.setFontSize(10); doc.text(`VAT No: ${profile.vatNumber}`, 20, 28); }
  doc.setFontSize(16); doc.text("Receipt", 20, 48);

  doc.setFont(undefined, "bold"); doc.setFontSize(12);
  doc.text(`Invoice No: INV-${inv.number}`, 20, 62);
  doc.setFont(undefined, "normal");
  doc.text("Paid in Full", 20, 70);
  doc.text(`Client: ${inv.client}`, 20, 85);
  if (inv.email) doc.text(`Email: ${inv.email}`, 20, 93);
  doc.text(`Subtotal: £${money(inv.amount)}`, 20, 108);
  if (inv.applyVAT) doc.text(`VAT (${loadProfile().vatRate}%): £${money(inv.vatAmount)}`, 20, 116);
  doc.text(`Total Paid: £${money(inv.total)}`, 20, inv.applyVAT ? 124 : 116);
  doc.text(`Date: ${todayUK()}`, 20, inv.applyVAT ? 132 : 124);

  const addFooter = () => {
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(`Bank Account: ${profile.bank}  |  Sort Code: ${profile.sortCode}`, 20, pageH - 18);
    doc.setFont(undefined, "normal");
    doc.text("Thank you for your custom.", 20, pageH - 10);
  };
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(); }

  const fileName = `Receipt_INV-${inv.number}_${safe(profile.companyName)}.pdf`;
  return { save: () => doc.save(fileName), toBase64: () => doc.output("datauristring").split(",")[1], fileName };
}

/* ========= Email helper (web only) ========= */
async function openEmail({ to, subject, body, attachmentBase64, attachmentFileName }) {
  // Note: mailto: cannot attach files. We already download the PDF separately.
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  return false;
}


/* ========= Root App ========= */
export default function App() {
  const [tab, setTab] = useState("invoices");
  const [invoices, setInvoices] = useState(() => {
    try { return JSON.parse(localStorage.getItem("invoices") || "[]"); } catch { return []; }
  });
  const [nextNumber, setNextNumber] = useState(() => {
    const saved = localStorage.getItem("nextNumber");
    return saved ? Number(saved) : 1001;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => localStorage.setItem("invoices", JSON.stringify(invoices)), [invoices]);
  useEffect(() => localStorage.setItem("nextNumber", String(nextNumber)), [nextNumber]);
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const withStatus = useMemo(() => {
    const now = new Date();
    return invoices.map((inv) => {
      if (inv.status === "Paid") return inv;
      const diff = daysBetween(parseUK(inv.date), now);
      const safeDiff = clampNonNegative(diff);
      if (safeDiff >= 7) return { ...inv, status: "Overdue", _od: Math.min(safeDiff, 1825) };
      return { ...inv, status: "Unpaid", _od: 0 };
    });
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStatus.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${i.client} ${i.email} INV-${i.number} ${i.description}`.toLowerCase();
      return hay.includes(q);
    });
  }, [withStatus, query, statusFilter]);

  const overdueCount = withStatus.filter((i) => i.status === "Overdue").length;

  return (
    <div className="h-screen flex flex-col">
      <header className="header">
        <div className="row" style={{ gap: 16 }}>
          <strong>Invoicer</strong>
          <button className="btn" onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <button className="btn" onClick={() => setTab("invoices")}>Invoices</button>
          <button className="btn" onClick={() => setTab("clients")}>Clients</button>
          <button className="btn" onClick={() => setTab("settings")}>Settings</button>
        </div>
      </header>

      <main className="container" style={{ flex: 1, overflowY: "auto" }}>
        {tab === "invoices" && (
          <InvoicesTab
            invoices={filtered}
            allInvoices={withStatus}
            setInvoices={setInvoices}
            nextNumber={nextNumber}
            setNextNumber={setNextNumber}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        )}
        {tab === "clients" && <ClientsTab invoices={withStatus} />}
        {tab === "settings" && (
          <SettingsTab
            nextNumber={nextNumber}
            setNextNumber={setNextNumber}
            setInvoices={setInvoices}
          />
        )}
      </main>

      <footer className="footer">© {new Date().getFullYear()} Your Business Name</footer>

      {overdueCount > 0 && (
        <div style={{ position: "fixed", bottom: 20, right: 16 }}>
          <span className="badge overdue">{overdueCount} overdue</span>
        </div>
      )}
    </div>
  );
}

/* ========= Invoices Tab ========= */
function InvoicesTab({ invoices, allInvoices, setInvoices, nextNumber, setNextNumber, query, setQuery, statusFilter, setStatusFilter }) {
  const addInvoice = (payload) => {
    setInvoices((prev) => [{ ...payload, status: "Unpaid" }, ...prev]);
    setNextNumber((n) => n + 1);
  };

  const markPaid = async (inv) => {
    if (!window.confirm(`Mark INV-${inv.number} as Paid and email a receipt?`)) return;
    const updated = allInvoices.map((i) => (i.number === inv.number ? { ...i, status: "Paid" } : i));
    setInvoices(updated);

    const receipt = buildReceiptPDF(inv);
    const to = inv.email?.trim();
    if (!to) {
      alert("No client email set on this invoice.\nWe'll just download the receipt PDF.");
      receipt.save();
      return;
    }
    const profile = loadProfile();
    await openEmail({
      to,
      subject: `Receipt for Invoice INV-${inv.number} from ${profile.companyName}`,
      body: `Please find your receipt attached.`,
      attachmentBase64: receipt.toBase64(),
      attachmentFileName: receipt.fileName,
    });
  };

  const downloadPDF = (inv) => buildInvoicePDF(inv).save();

  const emailInvoice = async (inv) => {
    const to = inv.email?.trim();
    if (!to) { alert("No client email set on this invoice."); return; }
    const pdf = buildInvoicePDF(inv);
    const profile = loadProfile();
    await openEmail({
      to,
      subject: `Invoice INV-${inv.number} from ${profile.companyName}`,
      body: `Please find your invoice attached.`,
      attachmentBase64: pdf.toBase64(),
      attachmentFileName: pdf.fileName,
    });
  };

  const exportCSV = () => {
    const headers = [
      "number","date","client","email","amount","applyVAT","vatAmount","total","status","description"
    ];
    const lines = [headers.join(",")];
    allInvoices.forEach((i) => {
      const row = [i.number, i.date, i.client, i.email, money(i.amount), Boolean(i.applyVAT), money(i.vatAmount || 0), money(i.total || i.amount), i.status, (i.description || "").replace(/\n/g, " ")];
      lines.push(row.map((v) => typeof v === "string" && v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="row" style={{ flexDirection: "column", gap: 16 }}>
      <NewInvoiceForm nextNumber={nextNumber} onCreate={addInvoice} />

      <div className="row card" style={{ alignItems: "center", gap: 8 }}>
        <input className="input search" placeholder="Search invoices (client, email, number, notes)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Overdue">Overdue</option>
          <option value="Paid">Paid</option>
        </select>
        <button className="btn" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Reset</button>
        <button className="btn indigo" onClick={exportCSV}>Export CSV</button>
      </div>

      <section className="row" style={{ flexDirection: "column", gap: 8 }}>
        <h2>All Invoices</h2>
        {invoices.map((inv) => (
          <div key={inv.number} className="card row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ minWidth: 260 }}>
              <div><strong>INV-{inv.number}</strong> — {inv.client}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Date: {inv.date} · Subtotal: £{money(inv.amount)}{inv.applyVAT ? ` · VAT: £${money(inv.vatAmount)} · Total: £${money(inv.total)}` : ""}
              </div>
              {inv.description && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {inv.description.length > 100 ? inv.description.slice(0, 100) + "…" : inv.description}
                </div>
              )}
              {inv.status === "Overdue" && (
                <div style={{ fontSize: 11, color: "var(--red-600)", marginTop: 4 }}>
                  {Math.min(inv._od || 0, 1825)} days overdue
                </div>
              )}
            </div>
            <div className="row">
              <Badge status={inv.status} />
              <button className="btn primary" onClick={() => downloadPDF(inv)}>PDF</button>
              <button className="btn indigo" onClick={() => emailInvoice(inv)}>Email</button>
              {(inv.status === "Unpaid" || inv.status === "Overdue") && (
                <button className="btn green" onClick={() => markPaid(inv)}>Mark Paid</button>
              )}
            </div>
          </div>
        ))}
        {invoices.length === 0 && <div className="muted">No invoices match your filters.</div>}
      </section>
    </div>
  );
}
function Badge({ status }) {
  if (status === "Paid")   return <span className="badge paid">Paid</span>;
  if (status === "Overdue")return <span className="badge overdue">Overdue</span>;
  return <span className="badge pending">Pending</span>;
}

/* ========= New Invoice Form (with VAT) ========= */
function NewInvoiceForm({ nextNumber, onCreate }) {
  const profile = loadProfile();
  const [client, setClient] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayUK());
  const [description, setDescription] = useState("");
  const [applyVAT, setApplyVAT] = useState(Boolean(profile.vatRate));
  const [errors, setErrors] = useState({});

  const numbers = () => {
    const net = Number(amount) || 0;
    const rate = applyVAT ? Number(loadProfile().vatRate || 0) : 0;
    const vat = +(net * (rate / 100)).toFixed(2);
    const total = +(net + vat).toFixed(2);
    return { net, rate, vat, total };
  };

  const validate = () => {
    const e = {};
    if (!client.trim()) e.client = "Client name is required.";
    if (!email.trim()) e.email = "Client email is required.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email.";
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = "Enter a valid amount.";
    if (!date || isNaN(parseUK(date))) e.date = "Enter a valid UK date (DD/MM/YYYY).";
    if (!description.trim()) e.description = "Please describe the goods/services supplied.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const { net, vat, total, rate } = numbers();
    onCreate({
      number: nextNumber,
      client: client.trim(),
      email: email.trim(),
      amount: net,
      vatAmount: vat,
      total,
      applyVAT,
      vatRate: rate,
      date: date.trim(),
      description: description.trim(),
      status: "Unpaid",
    });
    setClient(""); setEmail(""); setAmount(""); setDate(todayUK()); setDescription("");
  };

  const { net, vat, total, rate } = numbers();

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>New Invoice</h2>
        <div style={{ fontSize: 12 }} className="muted">Next: INV-{nextNumber}</div>
      </div>

      <form onSubmit={submit} className="row" style={{ gap: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label className="label">Client Name *</label>
          <input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Ltd" />
          {errors.client && <div style={{ color: "var(--red-600)", fontSize: 12 }}>{errors.client}</div>}
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <label className="label">Client Email *</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@acme.com" />
          {errors.email && <div style={{ color: "var(--red-600)", fontSize: 12 }}>{errors.email}</div>}
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="label">Amount (£) *</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          {errors.amount && <div style={{ color: "var(--red-600)", fontSize: 12 }}>{errors.amount}</div>}
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="label">Invoice Date (UK) *</label>
          <input className="input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="DD/MM/YYYY" />
          {errors.date && <div style={{ color: "var(--red-600)", fontSize: 12 }}>{errors.date}</div>}
        </div>

        <div style={{ flexBasis: "100%" }}>
          <label className="label">Goods / Services Supplied *</label>
          <textarea className="input" style={{ height: 110 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Web design – 5 pages; Hosting – 12 months; Support – 4 hours" />
          {errors.description && <div style={{ color: "var(--red-600)", fontSize: 12 }}>{errors.description}</div>}
        </div>

        <div style={{ flexBasis: "100%" }} className="row">
          <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={applyVAT} onChange={(e) => setApplyVAT(e.target.checked)} /> Apply VAT ({rate}% from Settings)
          </label>
          <div className="muted" style={{ fontSize: 12 }}>
            Subtotal £{money(net)}{applyVAT ? ` · VAT £${money(vat)} · Total £${money(total)}` : ""}
          </div>
        </div>

        <div style={{ flexBasis: "100%", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="reset" className="btn" onClick={() => { setClient(""); setEmail(""); setAmount(""); setDate(todayUK()); setDescription(""); setApplyVAT(Boolean(loadProfile().vatRate)); }}>
            Clear
          </button>
          <button type="submit" className="btn primary">Create Invoice</button>
        </div>
      </form>
    </section>
  );
}

/* ========= Clients Tab ========= */
function ClientsTab({ invoices }) {
  const unique = new Map();
  (invoices || []).forEach((i) => {
    const key = (i.email || i.client || "").toLowerCase();
    if (!key) return;
    const entry = unique.get(key) || { name: i.client || "Unknown", email: i.email || "", total: 0, outstanding: 0, overdue: 0 };
    const amt = Number(i.total || i.amount) || 0;
    entry.total += amt;
    if (i.status !== "Paid") entry.outstanding += amt;
    if (i.status === "Overdue") entry.overdue += 1;
    unique.set(key, entry);
  });
  const rows = Array.from(unique.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <section className="row" style={{ flexDirection: "column", gap: 8 }}>
      <h2>Clients</h2>
      {rows.length === 0 && <div className="muted">No clients yet (create an invoice first).</div>}
      {rows.map((c) => (
        <div key={c.email || c.name} className="card row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div><strong>{c.name}</strong></div>
            <div className="muted" style={{ fontSize: 12 }}>{c.email}</div>
          </div>
          <div style={{ fontSize: 12 }}>
            <div>Total: £{money(c.total)}</div>
            <div style={{ color: c.outstanding > 0 ? "var(--red-600)" : "var(--green-600)" }}>
              Outstanding: £{money(c.outstanding)}
            </div>
            {c.overdue > 0 && <div style={{ color: "var(--red-600)" }}>{c.overdue} overdue</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ========= Settings Tab ========= */
function SettingsTab({ nextNumber, setNextNumber, setInvoices }) {
  const [val, setVal] = useState(nextNumber);

  // --- Backup (download JSON) ---
  const handleBackup = () => {
    try {
      const data = {
        profile: loadProfile(),
        invoices: JSON.parse(localStorage.getItem("invoices") || "[]"),
        nextNumber: Number(localStorage.getItem("nextNumber") || nextNumber),
        version: 1,
        createdAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const a = document.createElement("a");
      a.href = url; a.download = `invoicer-backup-${stamp}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Couldn't create backup file.");
    }
  };

  // --- Restore (import JSON) ---
  const fileInputRef = React.useRef(null);
  const openFilePicker = () => fileInputRef.current?.click();

  const handleRestoreFile = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const snap = JSON.parse(text);
      if (!snap || typeof snap !== "object") throw new Error("Invalid backup format");

      if (Array.isArray(snap.invoices)) {
        localStorage.setItem("invoices", JSON.stringify(snap.invoices));
        setInvoices(snap.invoices);
      }
      if (typeof snap.nextNumber === "number" && snap.nextNumber > 0) {
        localStorage.setItem("nextNumber", String(snap.nextNumber));
        setNextNumber(snap.nextNumber);
      }
      if (snap.profile && typeof snap.profile === "object") {
        saveProfile(snap.profile);
      }
      alert("Backup restored successfully.");
    } catch (e) {
      console.error(e);
      alert("Couldn't restore backup. Make sure you chose a valid backup JSON.");
    } finally {
      ev.target.value = "";
    }
  };

  return (
    <div className="row" style={{ flexDirection: "column", gap: 16 }}>
      {/* Invoice numbering (existing) */}
      <div className="card" style={{ maxWidth: 480 }}>
        <h2>Invoice Numbering</h2>
        <label className="label">Next Invoice Number</label>
        <input className="input" type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} min={1} />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Sequential, increases automatically for every new invoice.
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={() => setVal(nextNumber)}>Reset</button>
          <button className="btn primary" onClick={() => {
            if (!window.confirm(`Set next invoice number to ${val}?`)) return;
            setNextNumber(Number(val) || nextNumber);
          }}>Save</button>
        </div>
      </div>

      {/* NEW: Local backup & restore */}
      <div className="card" style={{ maxWidth: 700 }}>
        <h2>Local Backup</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Create a backup file with your settings, invoices and numbering. Restore it anytime to this browser.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn indigo" onClick={handleBackup}>Download Backup (.json)</button>
          <button className="btn" onClick={openFilePicker}>Restore from File</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleRestoreFile} />
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Backups are stored on <strong>your</strong> device only. Keep them safe if they contain client details.
        </div>
      </div>

      <ProfileForm />
    </div>
  );
}

/* ========= Profile Form (VAT fields) ========= */
function ProfileForm() {
  const [profile, setProfile] = useState(() => loadProfile());
  const [saving, setSaving] = useState(false);

  const onChange = (key) => (e) => setProfile((p) => ({ ...p, [key]: e.target.value }));

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataURL = await readFileAsDataURL(file);
      const scaled = await scaleImageDataURL(dataURL, 300);
      setProfile((p) => ({ ...p, logo: scaled }));
    } catch (err) {
      alert("Could not load logo file.");
      console.error(err);
    }
  };

  const clearLogo = () => setProfile((p) => ({ ...p, logo: null }));

  const save = async () => {
    setSaving(true);
    try {
      const v = Number(profile.vatRate);
      if (isNaN(v) || v < 0 || v > 100) {
        alert("Please enter a valid VAT rate between 0 and 100.");
        return;
      }
      saveProfile({ ...profile, vatRate: v });
      alert("Profile saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 700 }}>
      <h3>Business Profile</h3>
      <div className="row" style={{ gap: 12 }}>
        <div style={{ flexBasis: "100%" }}>
          <label className="label">Business Name</label>
          <input className="input" value={profile.companyName} onChange={onChange("companyName")} placeholder="Your Business" />
        </div>

        <div style={{ flexBasis: "100%" }}>
          <label className="label">Business Address</label>
          <textarea className="input" style={{ height: 90 }} value={profile.address} onChange={onChange("address")} placeholder={"1 High Street\nTown\nAB1 2CD"} />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <label className="label">Bank Account</label>
          <input className="input" value={profile.bank} onChange={onChange("bank")} placeholder="12345678" />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <label className="label">Sort Code</label>
          <input className="input" value={profile.sortCode} onChange={onChange("sortCode")} placeholder="00-00-00" />
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="label">VAT Rate (%)</label>
          <input className="input" type="number" value={profile.vatRate} onChange={onChange("vatRate")} min={0} max={100} step={0.5} />
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <label className="label">VAT Number (optional)</label>
          <input className="input" value={profile.vatNumber} onChange={onChange("vatNumber")} placeholder="GB123456789" />
        </div>

        <div style={{ flexBasis: "100%" }}>
          <label className="label">Logo (optional, auto-scaled)</label>
          <div className="row" style={{ alignItems: "center" }}>
            <input type="file" accept="image/*" onChange={onLogoFile} />
            {profile.logo && (
              <>
                <img src={profile.logo} alt="Logo preview" style={{ height: 40, marginLeft: 8 }} />
                <button className="btn" type="button" onClick={clearLogo}>Remove</button>
              </>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Used on invoices and receipts (top-right).
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn" type="button" onClick={() => setProfile(loadProfile())}>Reset</button>
        <button className="btn primary" type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </div>
  );
}
