import React from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("UI crashed:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Alert severity="error">
        <Stack spacing={1}>
          <Typography sx={{ fontWeight: 900 }}>
            Dashboard UI crashed while rendering (caught safely).
          </Typography>
          <Typography variant="body2">
            Error: {String(this.state.error?.message || this.state.error)}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }
}
