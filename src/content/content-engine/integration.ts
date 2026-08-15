// `text` + union, not a PG enum — same reasoning as ADR-010. Each capability
// is a category of deterministic tool (video/image generation, video
// understanding, video assembly), not tied to one provider — `provider` on
// IntegrationConfig picks the implementation (Kling, OpenAI, Twelve Labs...).
export const integrationCapabilities = ['video_generation', 'image_generation', 'video_understanding', 'video_assembly'] as const;
export type IntegrationCapability = (typeof integrationCapabilities)[number];

export function isIntegrationCapability(value: string): value is IntegrationCapability {
  return (integrationCapabilities as readonly string[]).includes(value);
}
