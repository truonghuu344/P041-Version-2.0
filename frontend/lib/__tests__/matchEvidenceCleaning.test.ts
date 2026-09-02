import { normalizeMatchResult } from '../matchResultAdapter';

describe('match evidence cleaning', () => {
  it('shows only the best relevant evidence and keeps the partial conclusion explanatory', () => {
    const normalized = normalizeMatchResult({
      status: 'COMPLETED',
      result: {
        requirements: {
          matched: [],
          missing: [],
          uncertain: [],
          partial: [{
            requirement_id: 'docker',
            normalized_value: 'Docker',
            status: 'PARTIALLY_SUPPORTED',
            evidence: [
              { text: 'Python, React, Docker, Kubernetes, SQL Server', source_section: 'skills' },
              { text: 'Built services with Docker Compose', source_section: 'projects' },
            ],
          }],
        },
      },
    });

    const requirement = normalized.partialRequirements[0];
    expect(requirement.cvText).toContain('Built services with Docker Compose');
    expect(requirement.cvText).not.toContain('Kubernetes');
    expect(requirement.gapText).toContain('Docker');
    expect(requirement.gapText).not.toMatch(/optimi|improve/i);
  });
});
