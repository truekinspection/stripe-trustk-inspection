import {
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLinkedin,
  FaXRay,
} from "react-icons/fa";

export const socialLinks = [
  {
    icon: FaGithub,
    href: "#",
    label: "GitHub",
  },
  {
    icon: FaLinkedin,
    href: "#",
    label: "LinkedIn",
  },
  {
    icon: FaFacebook,
    href: "#",
    label: "Facebook",
  },
  {
    icon: FaInstagram,
    href: "#",
    label: "Instagram",
  },
  { icon: FaXRay, href: "#", label: "Twitter" },
];

export const pricing = [
  {
    id: "10201",
    plan: "Our Plan",
    price: "$89",
    features: [
      "1 Vehicle Report",
      "Vehicle Specification",
      "DMV Title History",
      "Safety Recall Status",
      "Online Listing History",
      "Junk & Salvage Information",
      "Accident Information",
    ],
  },
];

/**
 * Report checkout price — must match server-side PaymentIntent amount.
 * Stripe requires a minimum of $89 USD per charge.
 */
export const REPORT_PRICE_DISPLAY = "$89";
export const REPORT_PRICE_CENTS = 8900;
export const REPORT_CURRENCY = "usd";
