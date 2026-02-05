import { Paper, Stack, Typography } from "@mui/material";

export default function StatCard(props: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Paper sx={{ p: 2.2 }}>
      <Stack spacing={0.6}>
        <Typography variant="body2" color="text.secondary">
          {props.label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: "-0.02em" }}>
          {props.value}
        </Typography>
        {props.hint && (
          <Typography variant="caption" color="text.secondary">
            {props.hint}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}