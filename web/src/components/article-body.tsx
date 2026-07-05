import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleBlock } from "@/content/blog/types";

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (m) {
        const href = m[2];
        const label = m[1];
        parts.push(
          href.startsWith("http") ? (
            <a key={key++} href={href} rel="noopener noreferrer">
              {label}
            </a>
          ) : (
            <Link key={key++} href={href}>
              {label}
            </Link>
          )
        );
      } else {
        parts.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return <h2 key={i}>{block.text}</h2>;
          case "h3":
            return <h3 key={i}>{block.text}</h3>;
          case "p":
            return <p key={i}>{inline(block.text)}</p>;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item) => (
                  <li key={item}>{inline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="article-ol">
                {block.items.map((item) => (
                  <li key={item}>{inline(item)}</li>
                ))}
              </ol>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
