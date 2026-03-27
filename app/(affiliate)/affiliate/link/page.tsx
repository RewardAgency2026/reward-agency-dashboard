"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, Download, Link2 } from "lucide-react";

interface ProfileData {
  affiliate_code: string;
  name: string;
}

interface ClientsData {
  length: number;
}

export default function AffiliateLinkPage() {
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ["affiliate-profile"],
    queryFn: () => fetch("/api/affiliate/profile").then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: clients = [] } = useQuery<ClientsData[]>({
    queryKey: ["affiliate-clients"],
    queryFn: () => fetch("/api/affiliate/clients").then((r) => r.json()),
    staleTime: 60000,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  const referralLink = profile?.affiliate_code
    ? `${appUrl}/onboarding?ref=${profile.affiliate_code}`
    : "";

  const qrUrl = referralLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}`
    : null;

  function handleCopy() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `referral-qr-${profile?.affiliate_code ?? "code"}.png`;
    a.click();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Referral Link</h1>
        <p className="text-sm text-gray-500 mt-0.5">Share this link to refer new clients to Reward Agency</p>
      </div>

      {/* Referral link card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Link2 size={16} />
          <span>Your referral link</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-700 break-all select-all">
            {referralLink || <span className="text-gray-400 animate-pulse">Loading…</span>}
          </div>
          <button
            onClick={handleCopy}
            disabled={!referralLink}
            className="flex items-center gap-2 rounded-lg bg-[hsl(236,85%,55%)] px-4 py-3 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* QR Code */}
        {qrUrl && (
          <div className="flex flex-col items-center gap-4 pt-2">
            <img
              src={qrUrl}
              alt="Referral QR Code"
              width={200}
              height={200}
              className="rounded-lg border border-gray-200"
            />
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              Download QR Code
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Clients Referred</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(clients as unknown[]).length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Affiliate Code</p>
          <p className="mt-1 text-2xl font-bold font-mono text-[hsl(236,85%,55%)]">
            {profile?.affiliate_code ?? "—"}
          </p>
        </div>
      </div>

      {/* Tips card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">How it works</p>
        <p className="text-sm text-blue-700">
          Share this link with potential clients. When they sign up using your link, they will be automatically linked to your account and their top-ups will count towards your monthly commission.
        </p>
      </div>
    </div>
  );
}
