import type { IconType } from "react-icons";
import * as FontAwesome from "react-icons/fa";
import * as MaterialIcons from "react-icons/md";

export type IconFamily = "font-awesome" | "material";

export interface IconLibraryItem {
  name: string;
  label: string;
  family: IconFamily;
  style: "regular" | "solid" | "brands" | "filled";
  Icon: IconType;
}

const brandNames = new Set([
  "Fa500px", "FaAmazon", "FaApple", "FaBehance", "FaDiscord", "FaDribbble",
  "FaFacebook", "FaFacebookF", "FaGithub", "FaGoogle", "FaInstagram",
  "FaLinkedin", "FaLinkedinIn", "FaPinterest", "FaReddit", "FaSnapchat",
  "FaSpotify", "FaTiktok", "FaTumblr", "FaTwitch", "FaTwitter", "FaVimeo",
  "FaWhatsapp", "FaYoutube",
]);

const humanizeIconName = (name: string) =>
  name
    .replace(/^(Fa|Md)/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/Reg /, "")
    .trim();

const collectIcons = (icons: object, family: IconFamily): IconLibraryItem[] =>
  Object.entries(icons)
    .filter(([name, value]) => /^(Fa|Md)/.test(name) && typeof value === "function")
    .map(([name, value]) => ({
      name,
      label: humanizeIconName(name),
      family,
      style: family === "material"
        ? "filled"
        : name.startsWith("FaReg")
          ? "regular"
          : brandNames.has(name)
            ? "brands"
            : "solid",
      Icon: value as IconType,
    }));

export const ICON_LIBRARY: IconLibraryItem[] = [
  ...collectIcons(FontAwesome, "font-awesome"),
  ...collectIcons(MaterialIcons, "material"),
].sort((a, b) => a.label.localeCompare(b.label));
