export type RobotsInput = {
  index?: boolean;
  follow?: boolean;
};

export function buildRobots({ index = true, follow = true }: RobotsInput = {}) {
  return {
    index,
    follow
  };
}
