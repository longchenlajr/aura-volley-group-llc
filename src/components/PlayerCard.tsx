import Link from "next/link";
import { Player } from "@/content/players";

export default function PlayerCard({ player }: { player: Player }) {
  return (
    <Link href={`/team/${player.slug}`} className="group block">
      <div className="rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] transition p-6">
        <div className="text-sm tracking-[0.18em] uppercase text-white/55">
          {player.role ?? "Player"}
        </div>
        <div className="mt-2 text-xl font-medium text-white/90">
          {player.name}
        </div>
        <div className="mt-3 text-sm leading-7 text-white/55">
          {player.bio ?? "Aura Volley Group."}
        </div>
        <div className="mt-6 h-px w-12 bg-white/10 group-hover:bg-[rgba(160,120,255,0.35)] transition" />
      </div>
    </Link>
  );
}
