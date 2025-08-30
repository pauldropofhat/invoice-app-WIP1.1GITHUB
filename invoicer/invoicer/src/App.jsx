 import React, { useState } from "react";
import { FileText, Users, Settings, CheckCircle, Clock } from "lucide-react";

export default function App() {
  const [tab, setTab] = useState("invoices");

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Invoicer</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setTab("invoices")}
            className={`flex items-center gap-1 ${
              tab === "invoices" ? "font-bold underline" : ""
            }`}
          >
            <FileText size={18} /> Invoices
          </button>
          <button
            onClick={() => setTab("clients")}
            className={`flex items-center gap-1 ${
              tab === "clients" ? "font-bold underline" : ""
            }`}
          >
            <Users size={18} /> Clients
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex items-center gap-1 ${
              tab === "settings" ? "font-bold underline" : ""
            }`}
          >
            <Settings size={18} /> Settings
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {tab === "invoices" && <InvoicesTab />}
        {tab === "clients" && <ClientsTab />}
        {tab === "settings" && <SettingsTab />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-200 p-2 text-center text-sm">
        © {new Date().getFullYear()} Your Business Name
      </footer>
    </div>
  );
}

// --- Invoices Tab ---
function InvoicesTab() {
  const invoices = [
    { id: 1001, client: "Alice", amount: 250, status: "paid" },
    { id: 1002, client: "Bob", amount: 120, status: "overdue" },
    { id: 1003, client: "Charlie", amount: 400, status: "unpaid" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Invoices</h2>
      <div className="space-y-2">
        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="flex justify-between items-center bg-white shadow-sm p-3 rounded-lg border"
          >
            <span className="font-medium">
              INV-{inv.id} — {inv.client}
            </span>
            <span>£{inv.amount}</span>
            <StatusBadge status={inv.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "paid") {
    return (
      <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-sm">
        <CheckCircle size={14} /> Paid
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-full text-sm">
        <Clock size={14} /> Overdue
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-sm">
      Pending
    </span>
  );
}

// --- Clients Tab ---
function ClientsTab() {
  const clients = ["Alice", "Bob", "Charlie"];
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Clients</h2>
      <ul className="list-disc pl-5 space-y-1">
        {clients.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

// --- Settings Tab ---
function SettingsTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Settings</h2>
      <p>Here you can configure invoice numbers, logo, and payment footer.</p>
    </div>
  );
}
