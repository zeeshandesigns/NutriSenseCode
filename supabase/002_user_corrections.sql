-- NutriSense AI — user-correction columns on scans
--
-- When the model returns low_confidence (top1 < 0.70) and the user
-- picks a different option from the top-3 picker, we persist:
--   • user_corrected = true
--   • original_top1  = whatever the model originally guessed
--   • food_label     = (already overwritten with the user's pick)
--
-- This gives us a small dataset of "model said X, user says Y" pairs
-- which can be exported as supervised training data for the next
-- retraining cycle (manual export for FYP scope; pipeline-friendly
-- for production).
--
-- Run once in Supabase SQL Editor.

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS user_corrected boolean NOT NULL DEFAULT false;

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS original_top1 text;

CREATE INDEX IF NOT EXISTS scans_user_corrected
  ON scans (user_corrected)
  WHERE user_corrected = true;

-- Convenience view for the training-data export
CREATE OR REPLACE VIEW model_corrections AS
SELECT
  s.created_at,
  s.image_url,
  s.original_top1     AS model_guessed,
  s.food_label        AS user_corrected_to,
  s.confidence        AS final_confidence
FROM scans s
WHERE s.user_corrected = true
  AND s.image_url IS NOT NULL
ORDER BY s.created_at DESC;
