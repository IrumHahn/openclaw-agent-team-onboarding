# Approved plan JSON

The helper accepts one UTF-8 JSON object. Strings are plain text, not Markdown. Required fields are below. No secrets or credentials. IDs use lower-case letters, digits, and hyphens, beginning with a letter. The team ID names a new team folder; agent IDs must be globally unused in the target OpenClaw profile.

```json
{
  "version": 1,
  "team": {
    "id": "sample-team",
    "name": "Sample Team",
    "organization": "A small education business",
    "product": "Online workshops",
    "audience": "New business owners",
    "objective": "Launch the first workshop",
    "deadline": "Undecided",
    "successCriteria": ["A reviewed workshop outline is ready"],
    "constraints": ["Use existing tools", "No external sends without approval"],
    "tools": ["OpenClaw"],
    "userName": "Owner",
    "language": "English",
    "relationshipStyle": "Warm, direct colleagues"
  },
  "agents": [
    {
      "id": "sample-team-lead",
      "name": "Mira",
      "emoji": "🧭",
      "archetype": "Calm expedition guide",
      "role": "Coordinator",
      "mission": "Turn the workshop goal into a reviewed plan and coordinate specialists",
      "whyNow": "One owner is needed to keep discovery and drafting aligned",
      "addressUser": "Owner",
      "traits": ["Clear", "Curious", "Dependable"],
      "counterTraits": ["Not bossy", "Not vague", "Not overconfident"],
      "toneExamples": [
        "Update: The outline is ready for review.",
        "Disagreement: I recommend a smaller first workshop because ...",
        "Blocked: The audience is unclear; I checked X and need Y."
      ],
      "responsibilities": ["Own the first-week plan", "Review specialist output"],
      "outOfScope": ["Publish the workshop without approval"],
      "deliverables": ["Reviewed first-week plan"],
      "boundaries": ["Ask before external messages or production changes"],
      "failureProtocol": "Inspect the evidence, retry once if safe, then report the blocker and recovery option.",
      "firstTasks": [
        { "task": "Draft a one-page workshop brief", "why": "Align the team on the first goal", "doneWhen": "Owner can review audience, promise, and outline" }
      ],
      "coordinator": true
    }
  ]
}
```

For a multi-agent team, include exactly one `"coordinator": true`; other agents use `false` or omit it. One-agent plans may omit it. Optional `model` uses an installed OpenClaw model ID. Optional `avatar` is a workspace-relative image path or URL already supplied by the user; the helper does not generate images. Do not set `avatar` to a nonexistent local file.

The helper writes a copy of the team goal and roster to each new workspace. It does **not** change channel bindings, cron jobs, default agent, or existing agents. If the user wants to reuse an existing agent, list it in the proposal, but do not include it in this JSON's `agents` array; connecting existing agents requires a separately reviewed config change.

Commands:

```bash
node <skill-dir>/scripts/team_setup.mjs preview --plan <plan.json> [--profile <name>] [--workspace-root <absolute-parent-dir>]
node <skill-dir>/scripts/team_setup.mjs apply --plan <plan.json> --confirmed [--profile <name>] [--workspace-root <absolute-parent-dir>]
```
