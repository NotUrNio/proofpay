"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import AgStudio with SSR disabled since AG Studio is browser-only
const DynamicStudio = dynamic(
  async () => {
    const { AgStudio } = await import("ag-studio-react");
    const { AgStudioLicenseManager } = await import("ag-studio");

    const key = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
    if (key) {
      try {
        AgStudioLicenseManager.setLicenseKey(key);
      } catch (err) {
        console.warn("[AG Studio] License key initialization notice:", err);
      }
    }

    return function StudioInner(props: { style?: React.CSSProperties }) {
      return <AgStudio style={props.style || { width: "100%", height: "100%" }} />;
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-900 border border-slate-800 rounded-xl text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Mounting AG Studio Canvas...</span>
      </div>
    ),
  }
);

export interface AgStudioEmbedProps {
  style?: React.CSSProperties;
  className?: string;
}

export function AgStudioEmbed({ style, className }: AgStudioEmbedProps) {
  return (
    <div className={`w-full h-[600px] border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-2xl ${className || ""}`}>
      <DynamicStudio style={style} />
    </div>
  );
}

