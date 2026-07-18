import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleBlock, BlogPost } from "@/content/blog/types";
import { installUrl } from "@/lib/site";

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

function MidArticleCta({ cta }: { cta: NonNullable<BlogPost["midArticleCta"]> }) {
  return (
    <aside className="article-mid-cta" aria-label="Install AnimeVocab">
      <p className="article-mid-cta__headline">{cta.headline}</p>
      <p className="article-mid-cta__body">{cta.body}</p>
      <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
        {cta.buttonLabel ?? "Add to Chrome (free)"}
      </a>
    </aside>
  );
}

export function ArticleBody({
  blocks,
  midArticleCta,
}: {
  blocks: ArticleBlock[];
  midArticleCta?: BlogPost["midArticleCta"];
}) {
  const ctaAfterIndex = midArticleCta ? blocks.findIndex((b) => b.type === "h2") : -1;

  return (
    <div className="prose">
      {blocks.flatMap((block, i) => {
        const nodes: ReactNode[] = [];
        switch (block.type) {
          case "h2":
            nodes.push(<h2 key={i}>{block.text}</h2>);
            break;
          case "h3":
            nodes.push(<h3 key={i}>{block.text}</h3>);
            break;
          case "p":
            nodes.push(<p key={i}>{inline(block.text)}</p>);
            break;
          case "ul":
            nodes.push(
              <ul key={i}>
                {block.items.map((item) => (
                  <li key={item}>{inline(item)}</li>
                ))}
              </ul>
            );
            break;
          case "ol":
            nodes.push(
              <ol key={i} className="article-ol">
                {block.items.map((item) => (
                  <li key={item}>{inline(item)}</li>
                ))}
              </ol>
            );
            break;
          default:
            return [];
        }

        if (midArticleCta && i === ctaAfterIndex) {
          nodes.push(<MidArticleCta key={`${i}-cta`} cta={midArticleCta} />);
        }

        return nodes;
      })}
    </div>
  );
}
