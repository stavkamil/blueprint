/** The kinds of project blueprint creates. */
export const ProjectType = { Ts: "ts", Nextjs: "nextjs" } as const;

/** One of {@link ProjectType}'s values. */
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];
