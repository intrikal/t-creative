/**
 * socials — Social media link configuration used across Footer and About pages.
 *
 * Each entry includes a react-icons component for rendering the platform icon.
 */
import type { IconType } from "react-icons";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";

export interface SocialLink {
  label: string;
  href: string;
  icon: IconType;
  description: string;
}

export const socials: SocialLink[] = [
  {
    label: "@trinitlam",
    href: "https://www.instagram.com/trinitlam/",
    icon: FaInstagram,
    description: "Personal",
  },
  {
    label: "@lashedbytrini_",
    href: "https://www.instagram.com/lashedbytrini_/",
    icon: FaInstagram,
    description: "Lash artistry",
  },
  {
    label: "@linkedbytrini",
    href: "https://www.instagram.com/linkedbytrini/",
    icon: FaInstagram,
    description: "Permanent jewelry",
  },
  {
    label: "@knotsnstuff",
    href: "https://www.instagram.com/knotsnstuff/",
    icon: FaInstagram,
    description: "Handmade crochet",
  },
  {
    label: "Trini Lam",
    href: "https://www.linkedin.com/in/trini-lam-01b729146/",
    icon: FaLinkedinIn,
    description: "Professional",
  },
];
