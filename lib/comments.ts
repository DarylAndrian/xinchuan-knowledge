import { db } from "./db";

export interface CommentWithAuthor {
  id: number;
  page_id: number;
  author_id: number;
  author_name: string;
  author_role: string;
  parent_id: number | null;
  quote: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
}

export function getComments(pageId: number): CommentWithAuthor[] {
  const rows = db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.role AS author_role
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.page_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(pageId) as unknown as CommentWithAuthor[];
  return rows.map((r) => ({ ...r }));
}

export function countThreads(pageId: number): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM comments WHERE page_id = ? AND parent_id IS NULL AND deleted_at IS NULL"
    )
    .get(pageId) as unknown as { n: number };
  return row.n;
}
