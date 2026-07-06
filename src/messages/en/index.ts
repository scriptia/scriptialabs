const messages = {
  common: {
    skipToContent: 'Skip to content',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    toggleTheme: 'Toggle theme',
    languages: 'Languages',
    loading: 'Loading',
    notFoundTitle: 'Page not found',
    notFoundDescription: 'The page you are looking for could not be found.',
    errorTitle: 'Something went wrong',
    errorDescription: 'Please try again in a moment.',
    emptyTitle: 'Nothing here yet',
    emptyDescription: 'This area is ready for future content.',
    continue: 'Continue',
    productStatus: {
      draft: 'Concept',
      alpha: 'Private alpha',
      beta: 'Public beta',
      teaser: 'Launching soon',
      live: 'Live',
      deprecated: 'Deprecated',
      archived: 'Archived'
    },
    legalLinksTitle: 'Legal',
    legalDocLabels: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      cookies: 'Cookie Policy',
      aiPolicy: 'AI Policy',
      contact: 'Contact',
      dataDeletion: 'Data Deletion',
      acceptableUse: 'Acceptable Use Policy'
    }
  },
  navigation: {
    company: 'Company',
    products: 'Products',
    legal: 'Legal',
    socials: 'Socials',
    home: 'Home',
    about: 'About',
    careers: 'Careers',
    blog: 'Blog',
    press: 'Press',
    contact: 'Contact',
    privacy: 'Privacy Policy',
    terms: 'Terms',
    cookies: 'Cookies',
    security: 'Security',
    aiPolicy: 'AI Policy',
    scriptia: 'Scriptia',
    padelco: 'Padelco',
    voiceAgents: 'Voice Agents'
  },
  languages: {
    en: 'English',
    es: 'Spanish',
    ca: 'Catalan'
  },
  social: {
    x: 'X',
    linkedin: 'LinkedIn'
  },
  footer: {
    copyright: 'Scriptia Labs'
  },
  layout: {
    globalCtaTitle: 'Build the next product layer',
    globalCtaDescription: 'Scriptia Labs designs and builds AI-first products with long-term product thinking.',
    globalCtaPrimary: 'Contact',
    globalCtaSecondary: 'View products',
    announcement: 'Announcement'
  },
  products: {
    scriptia: {
      name: 'Scriptia',
      description: 'The flagship product platform.',
      hero: {
        title: 'An AI writing companion for editorial work.',
        description: "Scriptia helps writers and editorial teams draft, structure, and refine long-form work — without losing their voice in the process."
      },
      seo: {
        title: 'Scriptia — AI writing companion',
        description: 'Scriptia is an AI-first writing companion for editorial teams, built by Scriptia Labs.'
      },
      features: {
        writing: {
          title: 'Written with you, not for you',
          description: 'Scriptia drafts alongside you, keeping your voice and intent instead of replacing them with generic output.'
        },
        editorial: {
          title: 'Built for editorial structure',
          description: 'From outline to final draft, Scriptia understands how long-form editorial work is actually structured — not just paragraphs, but arguments.'
        },
        assistant: {
          title: 'An assistant, not a black box',
          description: 'Every suggestion is visible and reversible. You stay the author; Scriptia stays the collaborator.'
        }
      },
      page: {
        overview: {
          title: 'What Scriptia is',
          body: "Scriptia is our flagship product — an AI writing companion built for people who write for a living: editors, essayists, and teams producing long-form content. It's the clearest expression of how Scriptia Labs builds: opinionated, carefully scoped, and designed to get out of the writer's way."
        },
        capabilities: {
          title: 'What Scriptia can do'
        },
        howItWorks: {
          title: 'How it works',
          description: 'Scriptia fits into an existing writing process instead of replacing it.',
          steps: {
            1: { title: 'Start from an idea', description: "Bring a rough idea, an outline, or a half-finished draft — Scriptia works with whatever stage you're at." },
            2: { title: 'Draft and refine together', description: 'Scriptia proposes structure, phrasing, and edits inline. You accept, adjust, or ignore every suggestion.' },
            3: { title: 'Publish in your voice', description: 'The result reads like you wrote it — because you did, with Scriptia doing the parts that used to slow you down.' }
          }
        },
        why: {
          title: 'Why we built it',
          body: 'We built Scriptia because most AI writing tools optimize for speed at the expense of voice. We wanted the opposite: a tool that makes editorial work faster without making the writing sound like everyone else’s.'
        },
        status: {
          title: 'Current status',
          body: 'Scriptia is live today at scriptiastories.com, where you can use it directly. This page introduces the product — the product itself lives on its own site.'
        },
        faq: {
          title: 'Frequently asked questions',
          items: {
            1: { question: 'Is Scriptia part of Scriptia Labs?', answer: 'Yes — Scriptia is our flagship product, built and maintained by the same team behind Scriptia Labs.' },
            2: { question: 'Where can I use Scriptia?', answer: 'Scriptia runs at its own dedicated site, scriptiastories.com, linked from this page.' },
            3: { question: 'Who is Scriptia for?', answer: 'Writers, editors, and teams producing long-form editorial content who want an AI collaborator, not an AI replacement.' },
            4: { question: 'Does Scriptia write for me automatically?', answer: "No. Scriptia drafts and suggests; you decide what stays. It's built to keep you as the author." }
          }
        },
        cta: {
          title: 'Try Scriptia',
          description: 'Scriptia is live and ready to use today.',
          primary: 'Visit Scriptia',
          secondary: 'Back to products'
        }
      }
    },
    padelco: {
      name: 'Padelco',
      description: 'An AI padel coach launching soon.',
      hero: {
        title: 'AI coaching for padel players who want to improve.',
        description: 'Padelco brings structured, AI-driven coaching to padel training — built for players serious about their game. Launching soon.'
      },
      seo: {
        title: 'Padelco — AI padel coaching',
        description: 'Padelco is an AI-powered padel training platform from Scriptia Labs, launching soon.'
      },
      features: {
        coaching: {
          title: 'AI coaching, not generic drills',
          description: "Padelco is built around coaching your actual game, not a one-size-fits-all training plan."
        },
        progression: {
          title: 'Track real progression',
          description: 'See how your game develops over time, not just how a single session went.'
        },
        training: {
          title: 'A modern training experience',
          description: 'Padelco is designed for players who expect the same quality of experience from their training tools as from their game.'
        }
      },
      page: {
        overview: {
          title: 'What Padelco is',
          body: 'Padelco is an AI-powered padel training platform built for players who want to improve deliberately, not just play more. It’s the second product from Scriptia Labs, built with the same product discipline as Scriptia — applied to a completely different world: competitive padel.'
        },
        capabilities: {
          title: "What we're building toward"
        },
        howItWorks: {
          title: 'How it works',
          description: "Padelco is still in development — here's the shape of the experience we're building.",
          steps: {
            1: { title: 'Understand your game', description: "Padelco starts from where your game actually is, not a generic skill assumption." },
            2: { title: 'Get AI-driven coaching', description: 'Training guidance adapts to your progress, not a fixed program everyone follows.' },
            3: { title: 'Improve with structure', description: 'See your progression over time, with coaching that evolves as you do.' }
          }
        },
        why: {
          title: "Why we're building it",
          body: 'Padelco exists because padel is growing fast, but the coaching tools around it haven’t kept up. We saw an opportunity to bring the same AI-first, long-term thinking behind Scriptia into a sport we care about.'
        },
        status: {
          title: 'Current status',
          body: "Padelco is launching soon. We're building it deliberately rather than rushing a launch — this page will be the first place to know when that changes."
        },
        faq: {
          title: 'Frequently asked questions',
          items: {
            1: { question: 'When does Padelco launch?', answer: "We haven't announced a launch date yet. This page will be updated first." },
            2: { question: 'What does Padelco actually do?', answer: 'Padelco is an AI-powered padel coaching platform focused on real performance improvement and tracked progression.' },
            3: { question: 'Do I need to be a competitive player?', answer: 'No — Padelco is built for any player who wants to improve deliberately, at any level.' },
            4: { question: 'Can I sign up for updates?', answer: 'Not yet through this page — check back as we get closer to launch.' }
          }
        },
        cta: {
          title: 'Padelco is launching soon',
          description: "We're building Padelco carefully. Check back for updates as launch approaches.",
          primary: 'Back to all products'
        }
      }
    },
    voiceAgents: {
      name: 'Voice Agents',
      description: 'AI phone agents for businesses.',
      hero: {
        title: 'AI voice agents that handle real business calls.',
        description: 'Voice Agents answers calls, books appointments, and qualifies leads for real businesses — in beta today.'
      },
      seo: {
        title: 'Voice Agents — AI phone agents for business',
        description: 'Voice Agents provides AI-powered voice agents for customer support, appointment booking, and lead qualification. Currently in beta.'
      },
      features: {
        support: {
          title: 'Customer support that answers',
          description: 'Voice Agents handles real customer calls — not a scripted phone tree, an actual conversation.'
        },
        booking: {
          title: 'Appointment booking, automated',
          description: 'Callers can book, reschedule, or cancel appointments directly through the agent, without a human picking up.'
        },
        qualification: {
          title: 'Lead qualification on the call',
          description: 'Voice Agents asks the right questions to qualify a lead before it reaches your team.'
        }
      },
      page: {
        overview: {
          title: 'What Voice Agents is',
          body: 'Voice Agents gives businesses an AI phone agent that handles real conversations — customer support, appointment booking, and lead qualification — instead of routing every call to a human or a dead-end phone tree. It’s currently in beta, used by early customers as we refine it.'
        },
        capabilities: {
          title: 'What Voice Agents can do today'
        },
        howItWorks: {
          title: 'How it works',
          description: 'Voice Agents plugs into how a business already handles calls.',
          steps: {
            1: { title: 'Connect your phone line', description: 'Voice Agents is set up against your existing business number, not a separate new line.' },
            2: { title: 'The agent handles the call', description: 'Customer support, booking, or qualification — handled by the agent in a real conversation, not a menu.' },
            3: { title: 'Your team gets what matters', description: 'Calls that need a human are routed with context already gathered, not from scratch.' }
          }
        },
        why: {
          title: "Why we're building it",
          body: 'Most businesses either staff every call with a human or lose callers to a phone tree. Voice Agents exists for the middle ground businesses actually need: AI that handles the routine calls well enough that a human only steps in when it matters.'
        },
        status: {
          title: 'Current status',
          body: "Voice Agents is in beta. It's live and handling real calls for early customers, and still actively evolving — we're building confidence deliberately rather than claiming this is finished."
        },
        faq: {
          title: 'Frequently asked questions',
          items: {
            1: { question: 'Is Voice Agents fully launched?', answer: "No — it's currently in beta. It's live and working for early customers, but still being refined." },
            2: { question: 'What can Voice Agents actually do today?', answer: 'Handle customer support conversations, book and manage appointments, and qualify leads on the call.' },
            3: { question: 'Does it replace my support team?', answer: 'No — it handles the routine calls so your team can focus on the ones that need a person.' },
            4: { question: 'How do I get access?', answer: 'Voice Agents is currently working with early customers. Reach out through Scriptia Labs to learn more.' }
          }
        },
        cta: {
          title: 'Voice Agents is in beta',
          description: "We're working with early customers today and refining the product actively.",
          primary: 'Back to all products'
        }
      }
    }
  },
  homepage: {
    hero: {
      eyebrow: 'Scriptia Labs',
      title: 'Software built to outlast its first release.',
      description: 'Scriptia Labs is a software and AI lab. We design, build, and operate products meant to compound in value for years, not weeks.',
      primaryCta: 'Explore our products',
      secondaryCta: 'Our philosophy'
    },
    whoWeAre: {
      eyebrow: 'Who we are',
      title: 'A software and AI lab, not an agency.',
      body: "Scriptia Labs designs, builds, and operates AI-first products end to end. We're not hired to execute someone else's brief — we build things we believe should exist, and we stay to maintain them. Every product we ship carries the same standard: engineered well, designed with intent, built to still make sense in five years."
    },
    products: {
      eyebrow: 'Products',
      title: "What we're building",
      description: 'Three products, three different problems, one standard for how software should be made.',
      exploreLabel: 'Visit',
      items: {
        scriptia: {
          title: 'Scriptia',
          description: 'Our flagship platform — live today, and the clearest expression of how we build.'
        },
        padelco: {
          title: 'Padelco',
          description: 'An AI coach for padel players, built on the same product discipline as everything else we ship.'
        },
        voiceAgents: {
          title: 'Voice Agents',
          description: 'AI phone agents that handle real conversations for real businesses, in beta today.'
        }
      }
    },
    philosophy: {
      eyebrow: 'How we build',
      title: 'Our philosophy',
      description: 'The same principles guide every product we ship, regardless of what it does.',
      principles: {
        craftsmanship: {
          title: 'Craftsmanship',
          description: "We sweat details other teams skip — because users feel them, even when they can't name them."
        },
        purposefulAi: {
          title: 'AI with purpose',
          description: 'We reach for AI when it solves a real problem better than the alternative, and skip it everywhere else.'
        },
        longTerm: {
          title: 'Long-term thinking',
          description: "We build for the product's fifth year, not its first press release."
        },
        discipline: {
          title: 'Engineering discipline',
          description: "Good architecture is a form of respect for the people who'll maintain this after us."
        }
      }
    },
    why: {
      eyebrow: 'Why Scriptia Labs',
      title: 'What sets us apart',
      points: {
        builders: {
          title: 'We build, not consult.',
          description: "We're not paid by the hour. We build products we're accountable for — technically and commercially — long after launch."
        },
        practicalAi: {
          title: 'Practical AI, not hype.',
          description: 'We use AI where it genuinely improves a product, and say no to it everywhere else.'
        },
        oneTeam: {
          title: 'One team, every layer.',
          description: 'The same people who design the interface write the infrastructure. Nothing gets lost between disciplines.'
        }
      }
    },
    cta: {
      title: "See what we're building",
      description: 'Scriptia is live today. Padelco and Voice Agents are next.',
      primary: 'Visit Scriptia',
      secondary: 'View all products'
    }
  },
  legal: {
    common: {
      lastUpdated: 'Last updated {date}',
      onThisPage: 'On this page'
    },
    privacy: {
      title: 'Privacy Policy',
      description: 'How Scriptia Labs collects, uses, and protects information across our products and this website.',
      sections: {
        introduction: {
          title: 'Introduction',
          body: [
            'This Privacy Policy explains how Scriptia Labs ("we," "us," or "our") handles information in connection with this website and our products, including Scriptia, Padelco, and Voice Agents, as well as any products we launch in the future.',
            "By using our website or products, you agree to the practices described here. If you don't agree, please don't use them."
          ]
        },
        personalInformation: {
          title: 'Personal information',
          body: [
            "We collect information you provide directly, such as your name, email address, and any details you share when you contact us, sign up for a product, or reach out for support.",
            "We only collect what's needed to provide and improve our products — we don't ask for information we don't have a clear use for."
          ]
        },
        usageInformation: {
          title: 'Usage information',
          body: [
            "We collect information about how you use our website and products, including pages visited, features used, and general interaction patterns. This helps us understand what's working and what isn't.",
            "Usage information is generally aggregated and doesn't identify you individually unless it's tied to an account you've created."
          ]
        },
        cookies: {
          title: 'Cookies',
          body: [
            "We use cookies and similar technologies to keep our website and products working correctly and to understand how they're used. Our full approach to cookies, including how to manage your preferences, is described in our Cookie Policy."
          ]
        },
        analytics: {
          title: 'Analytics',
          body: [
            'We may use analytics tools to understand aggregate usage patterns across our website and products. Analytics data helps us prioritize what to build and fix, and is not used to build individual profiles for advertising purposes.'
          ]
        },
        logData: {
          title: 'Log data',
          body: [
            'Like most software products, our servers automatically record certain information when you use our website or products — such as IP address, browser type, device information, and timestamps. This log data is used for security, debugging, and reliability, and is retained only as long as it’s useful for those purposes.'
          ]
        },
        security: {
          title: 'Security',
          body: [
            'We take reasonable technical and organizational measures to protect information from unauthorized access, loss, or misuse. No system is perfectly secure, but we design our infrastructure and practices with security as a priority, not an afterthought — see our Security page for more detail.'
          ]
        },
        dataRetention: {
          title: 'Data retention',
          body: [
            "We retain information for as long as it's needed to provide our products, comply with legal obligations, resolve disputes, and enforce our agreements. When information is no longer needed for these purposes, we delete or anonymize it."
          ]
        },
        thirdPartyServices: {
          title: 'Third-party services',
          body: [
            'We work with a limited number of third-party service providers — for example, for hosting, analytics, or communication — who process information on our behalf under appropriate confidentiality and data protection commitments. We do not sell personal information to third parties.'
          ]
        },
        internationalTransfers: {
          title: 'International transfers',
          body: [
            'Information we collect may be processed in countries other than your own. Where this happens, we take steps to ensure it receives an appropriate level of protection, consistent with applicable data protection law.'
          ]
        },
        userRights: {
          title: 'Your rights',
          body: [
            'Depending on where you live, you may have rights to access, correct, delete, or export your personal information, or to object to or restrict certain processing. To exercise any of these rights, contact us using the details below.'
          ]
        },
        futureProducts: {
          title: 'Future products and integrations',
          body: [
            'This policy is written to apply to Scriptia Labs as a whole, not just our current products. As we launch new products or integrate new services, this policy — not a new one per product — will continue to govern how we handle information, updated as needed to reflect what’s genuinely new.'
          ]
        },
        changes: {
          title: 'Changes to this policy',
          body: [
            'We may update this policy as our products, legal obligations, or practices evolve. We’ll update the "last updated" date above when we do, and for material changes, we’ll make a reasonable effort to notify you.'
          ]
        },
        contact: {
          title: 'Contact',
          body: [
            'Questions about this policy or how we handle your information can be sent to our privacy team — see our Contact page for details.'
          ]
        }
      }
    },
    terms: {
      title: 'Terms of Service',
      description: 'The terms that govern your use of Scriptia Labs products and this website.',
      sections: {
        acceptance: {
          title: 'Acceptance of these terms',
          body: [
            "By accessing or using this website or any Scriptia Labs product, you agree to be bound by these Terms of Service. If you're using our products on behalf of an organization, you're agreeing on its behalf and confirming you have the authority to do so."
          ]
        },
        accounts: {
          title: 'Accounts',
          body: [
            "Some of our products require an account. You're responsible for keeping your account credentials secure and for all activity under your account. Let us know right away if you suspect unauthorized use."
          ]
        },
        intellectualProperty: {
          title: 'Intellectual property',
          body: [
            "Scriptia Labs and its products, including all associated branding, software, and content we create, are our intellectual property or that of our licensors. These terms don't grant you any rights to our intellectual property beyond what's needed to use our products as intended.",
            'Any content you create or provide through our products remains yours; you grant us only the rights needed to operate and improve the product for you.'
          ]
        },
        productAvailability: {
          title: 'Product availability',
          body: [
            "Our products exist at different stages of maturity — some are live, some are in beta, and some haven't launched yet. We aim to be clear about a product's current status, but we don't guarantee uninterrupted availability, and features may change as a product matures."
          ]
        },
        subscriptions: {
          title: 'Subscriptions and payment',
          body: [
            'Some products may be offered on a paid or subscription basis, now or in the future. Where that applies, pricing, billing terms, and cancellation policies will be presented clearly at the point of purchase and are incorporated into these terms by reference.'
          ]
        },
        acceptableUse: {
          title: 'Acceptable use',
          body: [
            "You agree not to use our products to violate any law, infringe on others' rights, interfere with the operation of our services, or attempt to gain unauthorized access to our systems or other users' data. We reserve the right to suspend access for use that violates this policy."
          ]
        },
        limitationOfLiability: {
          title: 'Limitation of liability',
          body: [
            'To the maximum extent permitted by law, Scriptia Labs will not be liable for indirect, incidental, or consequential damages arising from your use of our products. Our products are provided "as is," without warranties beyond those required by applicable law.'
          ]
        },
        termination: {
          title: 'Termination',
          body: [
            "You may stop using our products at any time. We may suspend or terminate access to our products if these terms are violated, or, for products in early stages, as part of the normal evolution of the product — where possible, we'll give reasonable notice."
          ]
        },
        changes: {
          title: 'Changes to these terms',
          body: [
            'We may update these terms as our products and practices evolve. We’ll update the "last updated" date when we do, and for material changes, we’ll make a reasonable effort to notify you before they take effect.'
          ]
        },
        governingLaw: {
          title: 'Governing law',
          body: [
            "[Placeholder: governing law and jurisdiction to be confirmed with legal counsel based on Scriptia Labs' registered entity.] These terms will be interpreted in accordance with the laws of that jurisdiction, without regard to conflict of law principles."
          ]
        }
      }
    },
    cookies: {
      title: 'Cookie Policy',
      description: 'How Scriptia Labs uses cookies and similar technologies across our website and products.',
      sections: {
        whatAreCookies: {
          title: 'What are cookies',
          body: [
            "Cookies are small text files stored on your device that help websites and applications function, remember preferences, and understand usage. We use a limited set of cookies, described below, and only what's needed for our website and products to work well."
          ]
        },
        necessaryCookies: {
          title: 'Necessary cookies',
          body: [
            "These cookies are required for our website and products to function — for example, to keep you signed in or remember your language preference. They can't be switched off, because without them core functionality wouldn't work."
          ]
        },
        analyticsCookies: {
          title: 'Analytics cookies',
          body: [
            "We may use analytics cookies to understand how our website and products are used in aggregate, so we can improve them. These cookies don't identify you individually and can generally be disabled without affecting core functionality."
          ]
        },
        functionalCookies: {
          title: 'Functional cookies',
          body: [
            "Functional cookies remember choices you've made — such as your theme preference — to make your experience more consistent across visits."
          ]
        },
        futureMarketingCookies: {
          title: 'Marketing cookies',
          body: [
            'We do not currently use marketing or advertising cookies. If that changes in the future, this policy will be updated first, and marketing cookies will only be set with your consent, consistent with applicable law.'
          ]
        },
        managingCookies: {
          title: 'Managing your preferences',
          body: [
            "Where cookies aren't strictly necessary, you can choose whether to allow them. As our cookie usage grows, we intend to offer a dedicated preference center — until then, browser-level controls (below) are the primary way to manage cookies."
          ]
        },
        browserControls: {
          title: 'Browser controls',
          body: [
            'Most browsers let you block or delete cookies through their settings. Doing so may affect how well our website and products work, particularly for necessary cookies.'
          ]
        },
        futureConsentManagement: {
          title: 'Future consent management',
          body: [
            'As our use of cookies expands — for example, if we introduce analytics or marketing cookies that require consent — we plan to adopt a formal consent management platform to give you clear, granular control at that time.'
          ]
        }
      }
    },
    security: {
      title: 'Security',
      description: 'How Scriptia Labs approaches security across our infrastructure, products, and practices.',
      sections: {
        philosophy: {
          title: 'Our approach to security',
          body: [
            'We treat security as a foundation of how we build, not a feature we add later. Every product we ship is built by the same team responsible for its infrastructure, which means security decisions are made by people who understand the system end to end, not handed off to a separate function after the fact.'
          ]
        },
        dataProtection: {
          title: 'Data protection',
          body: [
            "We apply the principle of least privilege internally — access to data and systems is limited to what's needed for a given role, and reviewed as our team and products grow. We minimize what we collect in the first place, which reduces what there is to protect."
          ]
        },
        encryption: {
          title: 'Encryption',
          body: [
            'Data is encrypted in transit using industry-standard protocols (TLS) across our website and products. Where sensitive data is stored, it’s encrypted at rest using our infrastructure providers’ standard encryption practices.'
          ]
        },
        responsibleDisclosure: {
          title: 'Responsible disclosure',
          body: [
            'If you discover a security vulnerability, we ask that you report it to us before disclosing it publicly, so we have a chance to investigate and fix it. Report vulnerabilities to security@scriptialabs.com — see our Contact page for more detail. We commit to acknowledging reports promptly and keeping you informed as we work through them.'
          ]
        },
        securityUpdates: {
          title: 'Security updates',
          body: [
            'We keep our infrastructure and dependencies current, and apply security patches as they become available, prioritized by severity. This is an ongoing, routine part of how we operate our products — not a one-time effort.'
          ]
        },
        incidentResponse: {
          title: 'Incident response',
          body: [
            'In the event of a security incident that affects user data, we will investigate promptly, take steps to contain and remediate it, and notify affected users and relevant authorities as required by applicable law.'
          ]
        },
        futureVulnerabilityReporting: {
          title: 'Future vulnerability reporting program',
          body: [
            'As Scriptia Labs and our products grow, we intend to formalize a structured vulnerability disclosure program, potentially including a public bug bounty. Until then, the responsible disclosure process above is the right way to report a concern.'
          ]
        }
      }
    },
    aiPolicy: {
      title: 'AI Policy',
      description: 'How Scriptia Labs approaches building and operating AI-first products.',
      sections: {
        humanOversight: {
          title: 'Human oversight',
          body: [
            "AI is a tool our products use, not an autonomous decision-maker acting on our users' behalf without their input. Across Scriptia, Padelco, and Voice Agents, people stay in the loop — reviewing, adjusting, or overriding AI-generated output is a core part of how each product is designed to be used, not an edge case."
          ]
        },
        transparency: {
          title: 'Transparency',
          body: [
            "We aim to be clear about where AI is involved in a product and what it's doing — whether that's a writing suggestion, a coaching recommendation, or a voice agent's response on a call. We don't believe AI should feel like a black box to the people relying on it."
          ]
        },
        responsibleUse: {
          title: 'Responsible use',
          body: [
            "We build AI features to solve specific, real problems for our users — not because AI is trending. If a capability doesn't genuinely improve a product, we leave it out, regardless of what's technically possible."
          ]
        },
        limitations: {
          title: 'Limitations',
          body: [
            'AI models make mistakes. They can misunderstand context, produce inaccurate output, or behave unpredictably in edge cases. We design our products assuming this will happen — with human review points, clear ways to correct or reject AI output, and no product that depends on AI being perfect to be safe or useful.'
          ]
        },
        bias: {
          title: 'Bias',
          body: [
            'AI models can reflect biases present in their training data or design. We evaluate the AI capabilities we build and the models we choose to work with for this risk, and we treat addressing it as ongoing work, not a box to check once.'
          ]
        },
        privacy: {
          title: 'Privacy and AI',
          body: [
            "Our approach to AI follows the same privacy principles as the rest of our products — see our Privacy Policy. We don't use customer data to train AI models for other customers' benefit, and we're deliberate about what data any AI feature actually needs to function."
          ]
        },
        continuousImprovement: {
          title: 'Continuous improvement',
          body: [
            'Our understanding of how to build AI responsibly will keep evolving, and so will this policy. We treat feedback from how our products are actually used — including where AI gets things wrong — as the primary input for improving both our products and our practices.'
          ]
        },
        futureModels: {
          title: 'Future models and capabilities',
          body: [
            "As we adopt new AI models or capabilities across our products, we evaluate them against the same principles in this policy before they ship — human oversight, transparency, and a clear, real problem being solved. Bigger or newer isn't the bar; better for the people using our products is."
          ]
        }
      }
    }
  },
  contact: {
    title: 'Contact',
    description: "Tell us what you need and we'll get back to you. For security disclosures, see our Security page instead of using this form.",
    form: {
      name: 'Name',
      namePlaceholder: 'Your name',
      email: 'Email',
      emailPlaceholder: 'you@example.com',
      category: 'What is this about?',
      message: 'Message',
      messagePlaceholder: 'Tell us a bit about what you need',
      submit: 'Send message',
      submitting: 'Sending…',
      successTitle: 'Message sent',
      successDescription: "Thanks for reaching out — we'll get back to you as soon as we can.",
      categories: {
        general: 'General enquiry',
        support: 'Product support',
        security: 'Security disclosure',
        privacy: 'Privacy request',
        partnerships: 'Business partnership',
        media: 'Media enquiry'
      }
    }
  },
  productLegal: {
    padelco: {
      privacy: {
        title: 'Padelco Privacy Policy',
        description: 'How the Padelco app collects, uses, and protects your information.',
        sections: {
          introduction: {
            title: 'Introduction',
            body: [
              'This Privacy Policy explains how Padelco, an AI-powered padel coaching app developed by Scriptia Labs, collects, uses, and protects your information. It applies specifically to the Padelco app on iOS and Android, not to other Scriptia Labs products.',
              'By using Padelco, you agree to the practices described in this policy.'
            ]
          },
          informationWeCollect: {
            title: 'Information we collect',
            body: [
              'To create and manage your account, we collect your email address and, where applicable, authentication information used to sign in.',
              'To provide coaching features, we collect information you generate while using the app: training data, player progress, routines, performance history, and usage statistics, along with your app preferences and settings.',
              'This is the complete list of what Padelco collects today. If that changes as the app grows, this policy will be updated first, and the "last updated" date above will reflect it.'
            ]
          },
          doNotCollect: {
            title: 'Information we do not collect',
            body: [
              'To be specific rather than leave this to inference: Padelco does not collect health or medical records, payment or financial information, government-issued identification, your contacts, precise or approximate location, microphone or audio recordings, advertising identifiers, or biometric data. Padelco does not currently process payments of any kind.',
              'If any of this changes in a future version of the app, we will update this policy before that change ships, not after.'
            ]
          },
          cameraPermission: {
            title: 'Camera permission',
            body: [
              "Padelco may request access to your device's camera so you can capture photos or videos related to your training — for example, to record a session for review.",
              "Camera access is never activated automatically or in the background. It is only used when you take an action that specifically calls for it, such as tapping a capture button within a training feature. If you decline this permission, you can still use the rest of Padelco; only features that specifically require capturing new photos or video will be unavailable."
            ]
          },
          photoLibraryPermission: {
            title: 'Photo library permission',
            body: [
              "Padelco may request access to your device's photo library so you can upload existing photos or videos related to your training, instead of capturing new ones.",
              'This access is user-initiated: it is triggered only when you choose to upload media, and Padelco only accesses the specific photo or video you select — it does not scan, index, or access the rest of your library in the background. If you decline this permission, you can still use the rest of Padelco; only features that specifically require uploading existing media will be unavailable.'
            ]
          },
          howWeUseInformation: {
            title: 'How we use your information',
            body: [
              "We use the information described above to provide Padelco's core features: tracking your training, generating performance statistics, and personalizing coaching feedback. We do not use your information for purposes beyond operating and improving Padelco, and we do not use it to build advertising profiles."
            ]
          },
          thirdPartyServices: {
            title: 'Service providers',
            body: [
              'We rely on a limited number of infrastructure providers — for example, for cloud hosting and account authentication — to operate Padelco. These providers process information on our behalf, under confidentiality and data protection commitments, and only to the extent needed to provide their service to us.',
              'We do not sell your information to third parties, and we do not share it with third parties for their own independent marketing purposes.'
            ]
          },
          aiGeneratedInsights: {
            title: 'AI-generated insights',
            body: [
              'Padelco uses your training data to generate coaching feedback and performance insights through AI. These insights are generated from the information described above and are used only to support your experience in the app — see our AI Policy for more detail on how this works and its limitations.'
            ]
          },
          automatedDecisionMaking: {
            title: 'Automated decision-making',
            body: [
              'Padelco’s AI-generated coaching feedback is designed to inform and support your own training decisions — it does not make decisions about you that produce legal effects or similarly significantly affect you, and it is not used for any form of automated profiling beyond providing the coaching feedback described in this policy.'
            ]
          },
          security: {
            title: 'Security',
            body: [
              'We apply reasonable technical and organizational measures to protect your information from unauthorized access, loss, or misuse, including encrypting data in transit. No system is perfectly secure, but security is a priority in how we build Padelco, not an afterthought — see our Security page for more detail.',
              'If we become aware of a security incident that affects your information, we will notify you and take appropriate action as required by applicable law.'
            ]
          },
          dataRetention: {
            title: 'Data retention',
            body: [
              'We retain your information for as long as your account is active and as needed to provide Padelco’s features. If you delete your account, we delete or anonymize your information as described in our Data Deletion page, except where retention is required by law or for the limited purposes described there.'
            ]
          },
          internationalTransfers: {
            title: 'International transfers',
            body: [
              'Your information may be processed in countries other than your own. Where this happens, we take steps to ensure it receives an appropriate level of protection, consistent with applicable data protection law.'
            ]
          },
          userRights: {
            title: 'Your rights',
            body: [
              'Depending on where you live, you may have rights to access the information we hold about you, correct it, delete it, export it in a portable format, restrict or object to certain processing, or withdraw consent where processing is based on consent.',
              'If you are located in the European Economic Area, the United Kingdom, California, or another jurisdiction with its own data protection law, you may have additional or more specific rights under that law — these are not reduced by anything in this policy.',
              'See our Data Deletion page to request deletion, or contact us using the details on our Contact page for any other request. We will respond within the timeframe required by applicable law, and in any case within a reasonable time.'
            ]
          },
          childrensPrivacy: {
            title: "Children's privacy",
            body: [
              'Padelco is not directed at children, and we do not knowingly collect information from children under the age required by applicable law to consent to data processing on their own behalf. If you believe a child has provided us with information, please contact us so we can remove it.'
            ]
          },
          changes: {
            title: 'Changes to this policy',
            body: [
              'We may update this policy as Padelco evolves. We’ll update the "last updated" date above when we do, and for material changes, we’ll make a reasonable effort to notify you.'
            ]
          },
          contact: {
            title: 'Contact',
            body: ['Questions about this policy can be sent to our privacy team — see our Contact page for details.']
          }
        }
      },
      terms: {
        title: 'Padelco Terms of Service',
        description: 'The terms that govern your use of the Padelco app.',
        sections: {
          eligibility: {
            title: 'Eligibility',
            body: [
              'You must be able to form a binding contract to use Padelco. If you are using Padelco on behalf of a minor or with parental permission, you are responsible for ensuring that use complies with applicable law.'
            ]
          },
          accounts: {
            title: 'Accounts',
            body: [
              "Using Padelco requires an account. You're responsible for keeping your account credentials secure and for all activity under your account. Let us know right away if you suspect unauthorized use."
            ]
          },
          acceptableUse: {
            title: 'Acceptable use',
            body: ['Your use of Padelco is also governed by our Acceptable Use Policy, which describes behavior that is not allowed on the platform.']
          },
          userContent: {
            title: 'User content',
            body: [
              "Photos, videos, and training data you upload or capture through Padelco remain yours. By using the app, you grant us the rights needed to store, process, and display that content back to you as part of providing Padelco's features — we don't use it for any other purpose.",
              'You are responsible for the content you upload or capture through Padelco, and for having the right to share it with us for this purpose.'
            ]
          },
          feedback: {
            title: 'Feedback',
            body: [
              'If you send us feedback, suggestions, or ideas about Padelco, you agree that we can use them to improve the app without any obligation to you. This doesn’t affect your rights over your own training data or content, described above.'
            ]
          },
          aiGeneratedInsights: {
            title: 'AI-generated insights',
            body: [
              "Padelco provides AI-generated coaching feedback and performance insights. These are informational and provided to support your training — they are not a substitute for professional coaching or medical advice, and Padelco does not guarantee their accuracy. See our AI Policy for more detail."
            ]
          },
          intellectualProperty: {
            title: 'Intellectual property',
            body: [
              "Padelco, including its software, design, and branding, is the intellectual property of Scriptia Labs or its licensors. These terms don't grant you any rights beyond what's needed to use the app as intended."
            ]
          },
          availability: {
            title: 'Availability',
            body: [
              "Padelco is currently launching and may not be continuously available. We aim to be clear about the app's current stage, but we don't guarantee uninterrupted availability, and features may change as the product matures."
            ]
          },
          serviceModifications: {
            title: 'Service modifications',
            body: [
              "We may add, change, or remove features in Padelco as the product evolves. Where a change materially affects how you use the app, we'll make a reasonable effort to let you know."
            ]
          },
          thirdPartyLinks: {
            title: 'Third-party links and services',
            body: [
              'Padelco may occasionally link to third-party websites or services that are not operated by us. We are not responsible for the content or practices of those third parties, and linking to them doesn’t mean we endorse them.'
            ]
          },
          termination: {
            title: 'Termination',
            body: [
              'You may stop using Padelco and delete your account at any time — see our Data Deletion page. We may suspend or terminate your access if these terms are violated.'
            ]
          },
          disclaimers: {
            title: 'Disclaimers',
            body: [
              'Padelco is provided "as is." We don’t guarantee that the app, including its AI-generated coaching insights, will be error-free or meet every expectation. Padelco is a training aid, not a substitute for professional coaching, medical, or safety advice.'
            ]
          },
          limitationOfLiability: {
            title: 'Limitation of liability',
            body: ['To the maximum extent permitted by law, Scriptia Labs will not be liable for indirect, incidental, or consequential damages arising from your use of Padelco.']
          },
          disputeResolution: {
            title: 'Dispute resolution',
            body: [
              '[Placeholder: our approach to resolving disputes — including whether disputes are handled through arbitration, small claims court, or another process — will be confirmed with legal counsel and added here before this document is finalized for production use.]'
            ]
          },
          governingLaw: {
            title: 'Governing law',
            body: [
              "[Placeholder: governing law and jurisdiction to be confirmed with legal counsel based on Scriptia Labs' registered entity.] These terms will be interpreted in accordance with the laws of that jurisdiction."
            ]
          },
          exportCompliance: {
            title: 'Export compliance',
            body: [
              'You may not use Padelco if you are located in, or a resident of, a country or region subject to a government embargo or sanctions restricting the use of software like Padelco, or if you are on any government list of prohibited or restricted parties.'
            ]
          },
          appStoreTerms: {
            title: 'App store terms',
            body: [
              'If you downloaded Padelco from the Apple App Store or Google Play, the following also applies. These terms are an agreement between you and Scriptia Labs only, not with Apple or Google, and Apple and Google are not responsible for Padelco or its content.',
              'Apple and Google have no obligation to provide maintenance or support for Padelco. In the event Padelco fails to conform to any warranty, you may notify Apple or Google, and they may refund the purchase price, if any, but that is their only warranty obligation, and any other claims, losses, or damages are our sole responsibility, not theirs.',
              'Apple and Google are not responsible for addressing any claims relating to Padelco, including product liability claims, claims that Padelco fails to meet applicable legal or regulatory requirements, or claims under consumer protection law. Apple and Google are third-party beneficiaries of these terms and, upon your acceptance, will have the right to enforce them against you.'
            ]
          }
        }
      },
      cookies: {
        title: 'Padelco Cookie Policy',
        description: 'How cookies are used, and not used, across the Padelco app and its website presence.',
        sections: {
          mobileAppAndCookies: {
            title: 'The Padelco app and cookies',
            body: [
              'Cookies are a web browser technology — the Padelco mobile app itself does not use cookies. Instead, the app may use standard on-device local storage to remember your sign-in state and preferences, which functions differently from browser cookies and is not shared with advertisers.'
            ]
          },
          similarTechnologies: {
            title: 'Similar technologies in the app',
            body: [
              'Beyond the local storage described above, Padelco does not currently use SDKs or similar technologies for advertising or cross-app tracking. Any technology used to operate the app that isn’t a cookie is still described in our Privacy Policy under Service providers, so this Cookie Policy doesn’t need to duplicate it.'
            ]
          },
          websiteCookies: {
            title: 'The Padelco website page',
            body: [
              'The Padelco marketing page at scriptialabs.com/padelco may use a small number of strictly necessary cookies required for the page to function correctly. It does not currently use analytics or marketing cookies.'
            ]
          },
          noAdvertisingCookies: {
            title: 'No advertising cookies or identifiers',
            body: ['Neither the Padelco app nor its website page currently uses advertising cookies or advertising identifiers to track you across apps or websites.']
          },
          management: {
            title: 'Managing cookies',
            body: [
              'For the website page, you can control cookies through your browser settings. For the app, since it does not use cookies, there is no cookie preference to manage — any future data choices will be handled through your device or account settings and communicated clearly.'
            ]
          },
          futureUpdates: {
            title: 'Future updates',
            body: ["If Padelco's use of cookies or similar technologies changes — for example, if analytics are added to the website page — this policy will be updated first."]
          }
        }
      },
      aiPolicy: {
        title: 'Padelco AI Policy',
        description: 'How Padelco uses AI to support your training, and its limitations.',
        sections: {
          howAiIsUsed: {
            title: 'How AI is used',
            body: ['Padelco uses AI to analyze your training data and generate coaching feedback, performance insights, and suggestions to support your progress as a padel player.']
          },
          informationalOnly: {
            title: 'Informational, not prescriptive',
            body: [
              'AI-generated recommendations in Padelco are informational. They are intended to support your training, not to replace the judgment of a qualified coach or, where relevant, medical professional.'
            ]
          },
          humanResponsibility: {
            title: 'You remain responsible',
            body: [
              "You remain responsible for your own training decisions and how you choose to act on Padelco's suggestions. If you have concerns about injury, fitness, or health, consult a qualified professional rather than relying on the app alone."
            ]
          },
          automatedDecisionMaking: {
            title: 'Automated decision-making',
            body: [
              'Padelco’s AI-generated coaching feedback is designed to inform your own decisions, not to make decisions about you. It does not produce automated decisions with legal or similarly significant effects, and it is not used to evaluate or score you for any purpose beyond the coaching feedback itself.'
            ]
          },
          limitations: {
            title: 'Limitations',
            body: [
              "AI models make mistakes. Padelco's coaching feedback can be inaccurate, incomplete, or not applicable to your specific situation, especially in edge cases the model hasn't seen enough of."
            ]
          },
          continuousImprovement: {
            title: 'Continuous improvement',
            body: ["We continue to refine how Padelco's AI features work based on how the app is actually used, including where its feedback falls short."]
          },
          privacyConsiderations: {
            title: 'Privacy considerations',
            body: [
              "Padelco's AI features use the training data described in our Privacy Policy, and only for the purpose of providing coaching feedback to you — not to build advertising profiles or for any purpose beyond operating the app."
            ]
          },
          noExaggeratedClaims: {
            title: 'No exaggerated claims',
            body: [
              "We don't claim Padelco's AI coaching replaces a human coach or guarantees improved performance. It's a tool to support your training, built and described honestly about what it can and can't do."
            ]
          }
        }
      },
      contact: {
        title: 'Contact',
        description: 'How to reach us about Padelco.',
        sections: {
          support: {
            title: 'App support',
            body: ['For help using Padelco, contact support@scriptialabs.com.']
          },
          privacy: {
            title: 'Privacy requests',
            body: ['To exercise your rights under our Privacy Policy, or to request data deletion, contact privacy@scriptialabs.com.']
          },
          security: {
            title: 'Security disclosures',
            body: ["If you've found a security vulnerability in Padelco, please report it responsibly to security@scriptialabs.com rather than disclosing it publicly."]
          },
          business: {
            title: 'Business enquiries',
            body: ['For partnership or business enquiries related to Padelco, contact partnerships@scriptialabs.com.']
          },
          legal: {
            title: 'Legal',
            body: ['For legal enquiries related to Padelco, contact legal@scriptialabs.com.']
          },
          responseTime: {
            title: 'Response time',
            body: ['We aim to respond to enquiries within a few business days. Security disclosures and privacy or data deletion requests are prioritized.']
          },
          languages: {
            title: 'Languages',
            body: ['You can reach us in English, Spanish, or Catalan — the same languages Padelco itself is available in.']
          }
        }
      },
      dataDeletion: {
        title: 'Padelco Data Deletion',
        description: 'How to request deletion of your Padelco account and data.',
        sections: {
          howToRequest: {
            title: 'How to request deletion',
            body: [
              'To delete your Padelco account and data, email privacy@scriptialabs.com from the email address associated with your account and request deletion. An in-app deletion option is planned — see below.'
            ]
          },
          whatIsDeleted: {
            title: 'What is deleted',
            body: ['Deleting your account removes your profile, training data, uploaded photos and videos, performance history, and preferences from active use.']
          },
          accountVsPartialDeletion: {
            title: 'Full account deletion only',
            body: [
              'Padelco currently supports deleting your entire account and its associated data. It does not yet offer a way to delete only specific pieces of information — such as a single training session — while keeping the rest of your account active. If you need only certain information removed, contact us and we will do what we reasonably can outside of a full account deletion.'
            ]
          },
          whatMayBeRetained: {
            title: 'What may be retained',
            body: [
              'We may retain limited information where required for legal, security, or fraud-prevention purposes, consistent with the retention practices described in our Privacy Policy. This information is not used for any other purpose.'
            ]
          },
          responseProcess: {
            title: 'Response process',
            body: ['We aim to process deletion requests within a reasonable time, typically within 30 days of receiving a verified request.']
          },
          futureInAppDeletion: {
            title: 'Future in-app deletion',
            body: ['We plan to add a self-service account deletion option directly within the app. Until then, deletion requests are handled by email as described above.']
          }
        }
      },
      acceptableUse: {
        title: 'Padelco Acceptable Use Policy',
        description: 'What is not allowed when using the Padelco app.',
        sections: {
          prohibitedBehaviour: {
            title: 'Prohibited behaviour',
            body: ['You agree not to use Padelco in any way that is unlawful, harmful, or interferes with the operation of the app or other users’ ability to use it.']
          },
          impersonation: {
            title: 'Impersonation',
            body: ['You may not impersonate another person or misrepresent your identity or affiliation with any person or organization when using Padelco.']
          },
          abuseAndFraud: {
            title: 'Abuse and fraud',
            body: ["You may not attempt to abuse, defraud, or manipulate Padelco's features, including its account or usage systems."]
          },
          reverseEngineering: {
            title: 'Reverse engineering',
            body: ['You may not reverse engineer, decompile, or attempt to extract the source code of Padelco, except where applicable law explicitly permits it.']
          },
          automatedMisuse: {
            title: 'Automated misuse',
            body: ['You may not use bots, scripts, or other automated means to access or interact with Padelco outside of normal, intended use.']
          },
          illegalContent: {
            title: 'Illegal content',
            body: ["You may not upload or share content through Padelco that is illegal, infringes on others' rights, or violates applicable law."]
          },
          accountSharing: {
            title: 'Account sharing',
            body: ['Padelco accounts are intended for individual use. Sharing an account in a way that misrepresents whose training data or performance history is being tracked is not permitted.']
          },
          reportingViolations: {
            title: 'Reporting violations',
            body: ['If you believe someone is violating this policy, contact us using the details on our Contact page. We review reports and take action consistent with our Terms of Service.']
          }
        }
      }
    }
  },
  seo: {},
  errors: {}
};

export default messages;
