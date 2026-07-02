import * as React from 'react';

export type SocialLink = {
  label: string;
  href: string;
};

export type SocialLinksProps = React.HTMLAttributes<HTMLDivElement> & {
  links: SocialLink[];
};

export function SocialLinks({ links, ...props }: SocialLinksProps) {
  return <div {...props}>{links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div>;
}
