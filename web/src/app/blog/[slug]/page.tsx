import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage, RelatedPosts, blogMetadata } from "@/components/article-page";
import { getAllBlogSlugs, getBlogPost, getRelatedPosts } from "@/content/blog/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return blogMetadata(post);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <ArticlePage post={post}>
      <RelatedPosts posts={getRelatedPosts(slug)} />
    </ArticlePage>
  );
}
