/**
 * InstagramFeed — Auto-synced Instagram grid for the landing page.
 *
 * Displays the latest posts cached in the `instagram_posts` table by
 * the cron job. Renders a horizontal scrollable strip on mobile and a
 * 2-row grid on desktop. Each tile links to the original IG post.
 *
 * Graceful degradation: if no posts are cached yet (Instagram not
 * configured or first deploy), the section is hidden entirely.
 *
 * Client Component — Framer Motion scroll-triggered reveal.
 */
"use client";

import { m } from "framer-motion";
import { FaInstagram } from "react-icons/fa";

export interface InstagramPost {
  id: number;
  igMediaId: string;
  igUsername: string;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  permalink: string;
  caption: string | null;
  postedAt: string;
}

/**
 * PostTile — Single Instagram post thumbnail with hover overlay and video indicator.
 *
 * Props:
 * - post: InstagramPost data (media URL, caption, permalink, type)
 * - index: position for stagger delay in the entrance animation
 */
function PostTile({ post, index }: { post: InstagramPost; index: number }) {
  // Ternary: VIDEO posts use thumbnailUrl for the static preview image; if no thumbnail
  // is available (null), falls back to mediaUrl. Image posts use mediaUrl directly.
  // Nullish coalescing (??) handles the case where thumbnailUrl is null.
  const imgSrc = post.mediaType === "VIDEO" ? (post.thumbnailUrl ?? post.mediaUrl) : post.mediaUrl;

  return (
    <m.a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block shrink-0 w-[200px] md:w-auto aspect-square overflow-hidden bg-foreground/5"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <img
        src={imgSrc}
        alt={post.caption?.slice(0, 100) ?? `Instagram post by @${post.igUsername}`}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
        <FaInstagram className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Conditional render: play button indicator only shows on VIDEO posts.
          Positioned top-right to not obscure the main image content. */}
      {post.mediaType === "VIDEO" && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/80 flex items-center justify-center">
          <div className="w-0 h-0 border-l-[5px] border-l-foreground border-y-[3px] border-y-transparent ml-0.5" />
        </div>
      )}
    </m.a>
  );
}

/**
 * InstagramFeed — Renders cached Instagram posts.
 *
 * Props:
 * - posts: array of InstagramPost objects fetched from the instagram_posts table by the server component
 *
 * Graceful degradation: returns null if no posts, hiding the section entirely.
 */
export function InstagramFeed({ posts }: { posts: InstagramPost[] }) {
  // Early return: if no posts are cached (first deploy or IG not configured),
  // hide the entire section rather than showing an empty grid.
  if (posts.length === 0) return null;

  // Optional chaining + nullish coalescing: safely extract username from first post.
  // posts[0] is guaranteed to exist after the length check, but ?. is defensive.
  const username = posts[0]?.igUsername ?? "";

  return (
    <section className="py-20 md:py-28 px-6 overflow-hidden" aria-label="Instagram Feed">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <m.div
          className="flex items-center justify-between mb-8 md:mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-accent mb-4 block">
              Follow Along
            </span>
            <h2 className="font-display text-2xl md:text-4xl font-light tracking-tight text-foreground leading-tight">
              Fresh from the studio
            </h2>
          </div>
          {/* Conditional render: profile link only shows when username is available (truthy string). */}
          {username && (
            <a
              href={`https://www.instagram.com/${username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs tracking-[0.15em] uppercase text-accent hover:text-foreground transition-colors"
            >
              <FaInstagram className="w-4 h-4" />@{username}
            </a>
          )}
        </m.div>

        {/* Mobile: horizontal scroll strip — md:hidden hides on desktop.
            posts.map() renders all posts as horizontally scrollable tiles with snap points. */}
        <div className="md:hidden flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory scrollbar-hide">
          {posts.map((post, i) => (
            <div key={post.igMediaId} className="snap-start">
              <PostTile post={post} index={i} />
            </div>
          ))}
        </div>

        {/* Desktop: 4-column grid. posts.slice(0, 8) limits to 8 posts (2 rows of 4).
            .slice() over CSS overflow-hidden because we want to avoid rendering off-screen
            elements that would still load images. */}
        <div className="hidden md:grid grid-cols-4 gap-3">
          {posts.slice(0, 8).map((post, i) => (
            <PostTile key={post.igMediaId} post={post} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
