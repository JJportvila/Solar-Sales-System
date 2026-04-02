# Solar Sales System Project Rules

## 1. Product Identity

- Chinese system name: `光伏管理系统`
- English system name: `Solar Sales System`
- Use this branding consistently in navigation, page headers, print templates, and default company profile text.

## 2. Layout Rules

- The admin system keeps one shared left sidebar across all internal pages.
- New internal features must only replace the right content area.
- The left sidebar must stay grouped by category and support collapse/expand.
- Current page menu item must be highlighted by default.
- The settings page uses the same left sidebar structure as the rest of the admin system.

## 3. Language Rules

- UI text must be managed through language packs.
- Supported languages:
  - `zh-CN`
  - `en`
  - `bi`
- New features must add keys to all three language files at the same time.
- In Chinese UI, visible text should be Chinese unless it is a required industry term, model name, or unit.
- Customer-facing printed documents must always be in English, regardless of UI language.

## 4. Document Rules

- Sales page prints `QUOTATION`.
- Invoice management page prints `INVOICE`.
- Receipt printing uses `PAYMENT RECEIPT`.
- Printed documents should be optimized for a single page whenever practical.
- Do not show `LOAD DETAILS` in printed customer documents.
- Remove bank details unless explicitly required by the current approved template.
- Show customer information and installment tables in printed documents.
- Show that prices are tax inclusive and also display the included tax amount.
- QUOTATION and INVOICE are separate document types and must not be merged.

## 5. Pricing And Tax Rules

- The whole system uses a global tax-inclusive pricing model.
- Individual packages cannot switch between tax-inclusive and tax-exclusive modes.
- Package prices are already tax inclusive.
- Quote totals should not add VAT on top of package prices again.
- Installation fee and logistics fee are optional and editable per quote.
- Installment amount is calculated from:
  - total amount
  - minus deposit
  - divided by selected term count
- Installment rounding rule:
  - round up to the nearest thousand for the first terms
  - final term pays the remaining balance

## 6. Installment Rules

- Installment terms must support:
  - `3 terms`
  - `6 terms`
- Installment cycle must support:
  - `1 week`
  - `2 weeks`
  - `1 month`
- Deposit payment date is required when installment is used.
- Each installment row must support its own payment date.
- Installment records must include:
  - payment amount
  - payment date
  - collector
  - payment records
  - receipt number
- Collector must be selected from active employees with role:
  - `sales`
  - `sales_manager`
  - `admin`

## 7. Customer And Invoice Rules

- Customer page must support customer type and electricity usage type as separate fields.
- Warranty history must support serial-number-based query.
- Saved quotes must support preview, print, and conversion to invoice.
- Invoice management must support editing.

## 8. Inventory And Procurement Rules

- Inventory warnings must be real data, not placeholders.
- Stock in/out operations are only allowed for:
  - `admin`
  - `sales_manager`
- Stocktaking is only allowed for:
  - `admin`
  - `sales_manager`
- Stocktaking should use one button that opens a modal for multiple products.
- Added stocktaking rows must be blank by default.
- Long stocktaking lists must use a scrollable area.
- Vendor procurement must respect vendor product scope.
- Do not allow a vendor to sell items outside its assigned catalog.
- Ordering vendors is only allowed for:
  - `admin`
  - `sales_manager`
- Vendor orders must support multi-line items and multiple currencies where configured.

## 9. Employee And Payroll Rules

- Employees are never hard-deleted from the system.
- Delete behavior must be replaced by resignation/archive status.
- Sales payroll formula:
  - work time x hourly wage
  - plus commission
- Sales manager payroll formula:
  - base salary
  - plus commission
  - plus performance salary
- Employee page must allow editing commission rate for sales roles.

## 10. Field Sales Mobile Rules

- The field mobile page is for sales staff.
- It must support:
  - login/authentication
  - check-in/check-out
  - trip start/end
  - automatic track point upload
  - visit logging
  - photo upload
  - audio recording with progress and playback
  - visible coordinates under the address
- Backend must store:
  - field tracks
  - field visits
  - field check-in records
- Admin side must support:
  - attendance record view
  - payroll settlement view

## 11. Settings And Backup Rules

- Settings must support:
  - local backup
  - restore
  - daily backup
  - weekly backup
  - Google Drive backup
- Backup must include uploaded invoice images and related attachments.
- Google Drive configuration should support:
  - folder ID
  - access token
  - connection test
  - connection result showing account name and folder name

## 12. Development Rules

- Before adding a new feature, keep the existing visual shell unless the user explicitly asks to redesign it.
- Prefer fixing data flow fully from frontend to backend in the same task.
- Avoid leaving placeholder buttons or fake data once a feature is declared complete.
- When a rule in this file conflicts with an old chat instruction, this file should be treated as the current long-term default unless the user explicitly overrides it again.
