# DPI-HT-01 case review

Static website generated from `DPI-HT-01_Master_Decision_Tracker.xlsx` in the parent project. The workbook remains the authority for the student's certified answers. The site's `submission.json` and `diagnostics.json` are generated snapshots; edit the workbook and regenerate instead of editing those files by hand.

## Local review

From this directory, run `python -m http.server 8000`, then open:

- `http://localhost:8000/`
- `http://localhost:8000/review/`
- `http://localhost:8000/submission.json`

To regenerate after changing the workbook, run from the parent project directory:

```text
python dpi-ht-01-site/tools/build_data.py DPI-HT-01_Master_Decision_Tracker.xlsx
```

The generator uses `openpyxl`. It checks the supplied JSON rules, all 100 decision IDs, all 25 material review records, and numeric statement reconciliations. The `diagnostics.json` file records source gaps and items needing review. It does not change the workbook.

## GitHub and Vercel

Use this **directory** as the root of a separate GitHub repository. In Vercel, import that repository as an **Other** framework project. Leave the build command empty and set the output directory to `.` (the repository root). `vercel.json` provides the `/review` route. After deployment, check `/`, `/review`, and `/submission.json` in a private browser window before submitting the one public Vercel URL.

This repository publishes the student's answers and evidence register. The original case files and the editable workbook are intentionally kept in the parent project unless the student separately chooses to publish them.
