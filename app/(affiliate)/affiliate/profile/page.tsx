"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Pencil } from "lucide-react";
import { z } from "zod";

interface AffiliateProfile {
  id: string;
  affiliate_code: string;
  name: string;
  email: string;
  company: string;
  billing_address: string | null;
  billing_vat: string | null;
  commission_rate: string;
  status: string;
  created_at: string;
}

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company is required"),
  billing_address: z.string().optional(),
  billing_vat: z.string().optional(),
});

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || "—"}</span>
    </div>
  );
}

export default function AffiliateProfilePage() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editVat, setEditVat] = useState("");

  const { data: profile, isLoading } = useQuery<AffiliateProfile>({
    queryKey: ["affiliate-profile"],
    queryFn: () => fetch("/api/affiliate/profile").then((r) => r.json()),
    staleTime: 0,
  });

  function openEdit() {
    if (!profile) return;
    setEditName(profile.name);
    setEditCompany(profile.company);
    setEditAddress(profile.billing_address ?? "");
    setEditVat(profile.billing_vat ?? "");
    setError(null);
    setEditOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const result = editSchema.safeParse({
      name: editName,
      company: editCompany,
      billing_address: editAddress,
      billing_vat: editVat,
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["affiliate-profile"] });
      setEditOpen(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your affiliate account information</p>
        </div>
        {!isLoading && (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} />
            Edit Profile
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-6 py-2">
        {isLoading ? (
          <div className="space-y-4 py-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <InfoRow label="Name" value={profile?.name} />
            <InfoRow label="Email" value={profile?.email} />
            <InfoRow label="Company" value={profile?.company} />
            <InfoRow label="Affiliate Code" value={profile?.affiliate_code} />
            <InfoRow label="Commission Rate" value={profile ? `${parseFloat(profile.commission_rate).toFixed(2)}%` : null} />
            <InfoRow label="Billing Address" value={profile?.billing_address} />
            <InfoRow label="VAT Number" value={profile?.billing_vat} />
            <InfoRow
              label="Member Since"
              value={profile ? new Date(profile.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null}
            />
          </>
        )}
      </div>

      {/* Edit modal */}
      <div className={editOpen ? "fixed inset-0 z-50 flex items-center justify-center bg-black/40" : "hidden"}>
        <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Edit Profile</h2>
            <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
              <input
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Billing Address</label>
              <textarea
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] resize-none"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">VAT Number</label>
              <input
                value={editVat}
                onChange={(e) => setEditVat(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                placeholder="Optional"
              />
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-xs text-gray-500">
              Email, commission rate, and affiliate code cannot be changed.
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
