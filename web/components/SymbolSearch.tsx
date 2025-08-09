"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchSymbols, type SymbolItem } from "@/lib/api";

export default function SymbolSearch() {
  const [q, setQ] = useState("");
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSymbols(q.trim());
      setSymbols(data);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className='search__bar'>
        <input
          className='search__input'
          placeholder='Search base asset or symbol (e.g., BTC, ETH, SOL)'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
        />
        <button className='search__button' onClick={doSearch} disabled={loading}>
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {error && <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>}

      <div className='search__list'>
        {symbols.map((s) => (
          <div key={s.symbol} className='search__item'>
            <Link className='search__link' href={`/symbol/${s.symbol}`}>
              <div style={{ fontWeight: 600 }}>{s.symbol}</div>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>
                {s.baseAsset} / {s.quoteAsset}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
