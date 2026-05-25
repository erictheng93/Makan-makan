# Incident Triage Runbook

Use this for any live reliability, security, data, deployment, or realtime incident.

## First 10 Minutes

1. Name the incident with a timestamp: `inc-YYYYMMDD-HHMM`.
2. Assign one incident lead and one note taker.
3. State the user impact in one sentence.
4. Decide severity:
   - SEV1: ordering, auth, payments, or production API broadly unavailable.
   - SEV2: major degraded flow or single app unavailable.
   - SEV3: partial degradation with workaround.
5. Freeze deploys unless the incident lead approves a rollback or hotfix.

## Evidence Checklist

Collect:

- First bad timestamp.
- Last known-good deploy SHA.
- Current Cloudflare deployment IDs.
- Recent GitHub Actions runs.
- API `/info` output.
- Realtime `/health` output.
- Any failing smoke or customer path reproduction.

## Triage Order

1. Deployment/config regression.
2. Cloudflare platform or binding issue.
3. D1/KV/R2 availability or data integrity issue.
4. Application runtime error.
5. External provider issue.

## Mitigation Options

- Roll back Worker or Pages deploy.
- Disable a feature flag or module gate.
- Revert a configuration/secret change.
- Restore D1 into a new database and switch binding.
- Temporarily disable non-critical jobs if they amplify load.

## Closeout

Close the incident only after:

- User impact has stopped.
- Smoke checks pass.
- Monitoring or manual checks have stayed stable for at least 30 minutes.
- A follow-up issue exists for the root cause and any missing detection.

The incident notes must include the timeline, root cause if known, mitigation, verification commands, and remaining risks.
