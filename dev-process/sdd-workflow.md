# Notes on the AI Spec Driven Workflow

- **claude**: Ignore this file for making any decisions, this is only for my reference

- This notes has the steps used to create this app
- This includes how to create the SDD spec etc.,
- SDD resources

## Steps

- Create a spec (look at Spec Driven Development)
  - To create the spec, use chat to brainstorm you idea, and finally ask the LLM to create a spec from the chat information
  - Create a constitution (spec structure)
    - Give this to the LLM along with the brainstorming session info to create the spec.md
    - **Constituion: `Structure`** ***(refine and add)***
      - mission/vission 
      - high level outcomes (may be JTBD)
      - Target Personas
      - constraints
      - tech stack
      - infra
      - debugging, logging, APM etc., (instrument to troubeshoot in prod)
      - security considerations
      - Overall Testing Strategy
      - Data modeling an design
      > My Notes: Look at the 12factor app for inspiration
    - Constitution Files (Spec Driver Dev approach)
      - mission.md
      - tech-stack.md
      - roadmap.md
- Create a project plan (roadmap.md)
  - roadmap to get to the end of the project
  - This will be used to create steps (branches) and features needed 
- Feature Builds (Feature Spec)
  - Plan (Feature specific Plan) - plan.md
  - Execute (Sequence of Work) - requirement.md
  - Validate (How to validate Success) - validation.md
    - code review
    - test cases


## Resources

- Spec Driver Development
  - [SDD Course](https://www.deeplearning.ai/courses/spec-driven-development-with-coding-agents)
  - [Spec Driven Development GitRepo](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files)
- Open source Spec Driver Development Tools (look for github repos)
  - SpecKit
    -  provides "/" commands for creating constitution etc.,
  - OpenSpec (FissionAI)
- MCP
  - External Tool connectivity
- Agents.md
  - Agent rules
- Agent Skills
- skills.md (different from Agent Skills)
- Agent Client Protocol (ACP)
  - Agent to IDE correlation (e.g., where to put what files like skills.md etc.,)
    > - Agent is claude or codex
    > - Client is the IDE


