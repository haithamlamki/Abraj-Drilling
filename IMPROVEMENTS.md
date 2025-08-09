# Improvements for Abraj‑Drilling Project

This document summarizes the recommended improvements based on the detailed NPT requirements and additional workflows.

## Field Changes
| Old Field          | New Field            | Reason |
|--------------------|----------------------|--------|
| thePart            | parentEquipment      | Represent the failed parent equipment |
| failureDesc        | immediateCause       | Capture the immediate cause of failure |
| corrective         | correctiveAction     | Track corrective actions taken |
| notificationNumber | n2Number             | Align with N2 notification for Abraj type |
| investigationReport| investigationAiText  | AI-generated investigation summary |

Additional fields `year` and `month` should be derived from `date` and stored explicitly.

## Form and Validation
- Update the validation schema (`client/src/validation/nptEntry.ts`) to reflect the new field names and include `year` and `month`.
- Modify the single-entry form (`client/src/components/npt/npt-form.tsx`) to:
  - Compute `year` and `month` from the selected `date` and bind them to hidden inputs.
  - Replace inputs for `thePart`, `failureDesc`, `corrective`, and `notificationNumber` with `parentEquipment`, `immediateCause`, `correctiveAction`, and `n2Number`.
  - Remove obsolete fields like `investigationReport`.
- Modify the multi-entry form (`client/src/components/npt/npt-form-multi.tsx`) similarly, ensuring the table columns reflect the new field names and validation.

## Display Changes
- Update report detail pages (`client/src/pages/npt-report-detail.tsx`) to display the new fields. Provide fallbacks for old field names to preserve compatibility with existing data.

## Business Logic
- Adjust the `enabledFields` and `cleanupByType` functions in `shared/nptRules.ts` to enable or disable the new fields based on the NPT type (Contractual vs. Abraj).
- Ensure that when switching types, the appropriate fields are cleared and computed.

## Back-end Adjustments
- Update server-side schemas (`server/schemas/npt.ts` and `server/schemas/nptBulkSchema.ts`) to include `year` and `month` fields and use the new field names.
- Modify API endpoints to derive `year` and `month` from `date` on create/update.

## Additional Recommendations
- Implement AI-assisted extraction for NPT data from billing files, using the logic defined in `logics of billing upload.txt`.
- Provide clear error messages and validation for missing or invalid data.
- Offer user-friendly dashboards for administrators and drillers, summarizing NPT reports and approval statuses.
