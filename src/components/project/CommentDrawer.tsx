"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CommentRow } from "@/lib/types";

export function CommentDrawer({
  projectId,
  targetType,
  targetId,
}: {
  projectId: string;
  targetType: "shot" | "scene";
  targetId: string;
}) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase
      .from("comments")
      .select("*")
      .eq("target_id", targetId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (active) {
          setComments(data ?? []);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`comments-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `target_id=eq.${targetId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setComments((prev) => [...prev, payload.new as CommentRow]);
          } else if (payload.eventType === "UPDATE") {
            setComments((prev) =>
              prev.map((c) => (c.id === (payload.new as CommentRow).id ? (payload.new as CommentRow) : c))
            );
          } else if (payload.eventType === "DELETE") {
            setComments((prev) => prev.filter((c) => c.id !== (payload.old as CommentRow).id));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [targetId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const text = body;
    setBody("");
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, targetType, targetId, body: text }),
    });
  }

  async function toggleResolved(comment: CommentRow) {
    await fetch(`/api/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !comment.resolved }),
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs">
      {loading ? (
        <p className="text-neutral-500">Загрузка…</p>
      ) : comments.length === 0 ? (
        <p className="text-neutral-500">Пока нет комментариев.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3">
          {comments.map((c) => (
            <li key={c.id} className={c.resolved ? "opacity-50" : ""}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-neutral-200">{c.body}</p>
                <button onClick={() => toggleResolved(c)} className="shrink-0 text-neutral-500 hover:text-neutral-300">
                  {c.resolved ? "↺" : "✓"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Написать комментарий…"
          className="flex-1 rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-neutral-200"
        />
        <button type="submit" className="rounded bg-white text-neutral-900 px-3 py-1.5 font-medium">
          Отправить
        </button>
      </form>
    </div>
  );
}
