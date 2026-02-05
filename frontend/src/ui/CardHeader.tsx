import { Box, Stack, Typography } from "@mui/material";

export default function CardHeader(props: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
      <Box>
        <Typography sx={{ fontWeight: 900 }}>{props.title}</Typography>
        {props.subtitle && (
          <Typography variant="caption" color="text.secondary">
            {props.subtitle}
          </Typography>
        )}
      </Box>
      {props.right}
    </Stack>
  );
}
