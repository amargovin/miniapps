# AddSkill — Promote Pattern to Cookbook

## Trigger
A generated scene contains a `// NEW_PATTERN: description` comment, or user wants to add a technique to the cookbook.

## Steps

### Step 1: Identify Pattern
- Find `// NEW_PATTERN:` comments in generated scene files
- Or receive pattern description from user

### Step 2: Extract Pattern
- Isolate the pattern code from the scene
- Generalize it (remove scene-specific values)
- Document the parameters and when to use it

### Step 3: Write Skill File
Create `~/.claude/skills/Remox/skills/{category}/{pattern-name}.md`

Choose category:
- `guidance/` — general Remotion techniques
- `cinematic/` — visual effects and camera work
- `utilities/` — reusable helpers and patterns

Format:
```markdown
# Pattern Name

Brief description of what this pattern does and when to use it.

## When to Use
- Bullet points describing ideal scenarios

## Parameters
- List configurable values

## Code
\`\`\`tsx
// Complete working code example
\`\`\`

## Variations
- Alternative approaches or modifications
```

### Step 4: Write Example
Create `~/.claude/skills/Remox/skills/examples/{pattern-name}.tsx`
- Complete working scene component demonstrating the pattern
- Must follow scene component contract

### Step 5: Verify
- Ensure the example compiles (add to SceneRegistry, validate frame 0)
- Remove from registry after verification (it's a reference, not a project scene)

### Step 6: Report
- Skill file path
- Example file path
- Description of what was added
