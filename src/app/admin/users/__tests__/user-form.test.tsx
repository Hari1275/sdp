import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserForm } from "../user-form";

// Mock the user store
const mockCreateUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockCloseUserSheet = jest.fn();
const mockFetchRegions = jest.fn();
const mockFetchLeadMrs = jest.fn();

jest.mock("@/store/user-store", () => ({
  useUserStore: () => ({
    isSheetOpen: true,
    selectedUser: null,
    closeUserSheet: mockCloseUserSheet,
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    regions: [{ id: "region1", name: "Test Region" }],
    leadMrs: [{ id: "lead1", name: "Test Lead", username: "testlead" }],
    fetchRegions: mockFetchRegions,
    fetchLeadMrs: mockFetchLeadMrs,
  }),
}));

// Mock toast
jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

describe("UserForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show real-time password validation error", async () => {
    const user = userEvent.setup();
    render(<UserForm />);

    // Find password input
    const passwordInput = screen.getByLabelText(/Password \*/);

    // Type a short password
    await user.type(passwordInput, "123");

    // Should show validation error immediately
    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters")
      ).toBeInTheDocument();
    });
  });

  it("should show phone number validation error", async () => {
    const user = userEvent.setup();
    render(<UserForm />);

    // Find phone input
    const phoneInput = screen.getByLabelText("Phone");

    // Type invalid phone number
    await user.type(phoneInput, "123abc");

    // Should show validation error
    await waitFor(() => {
      expect(
        screen.getByText("Phone number must be 10 digits")
      ).toBeInTheDocument();
    });
  });

  it("should show validation errors for required fields when form is submitted", async () => {
    const user = userEvent.setup();
    render(<UserForm />);

    // Find and click submit button
    const submitButton = screen.getByRole("button", { name: /Create User/ });
    await user.click(submitButton);

    // Should show validation errors for required fields
    await waitFor(() => {
      expect(
        screen.getByText("Username must be at least 3 characters")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Name must be at least 2 characters")
      ).toBeInTheDocument();
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(
        screen.getByText("Password must be at least 8 characters")
      ).toBeInTheDocument();
    });
  });

  it("should map server validation errors to specific fields", async () => {
    const user = userEvent.setup();

    // Mock createUser to throw a validation error
    mockCreateUser.mockRejectedValue(
      new Error("Password must be at least 8 characters")
    );

    render(<UserForm />);

    // Fill form with valid data except short password
    await user.type(screen.getByLabelText(/Username/), "testuser");
    await user.type(screen.getByLabelText(/Full Name/), "Test User");
    await user.type(screen.getByLabelText(/Email/), "test@example.com");
    await user.type(screen.getByLabelText(/Password/), "123");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /Create User/ });
    await user.click(submitButton);

    // Should map server error to password field
    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters")
      ).toBeInTheDocument();
    });
  });

  it("should handle duplicate username/email server error", async () => {
    const user = userEvent.setup();

    // Mock createUser to throw a duplicate error
    mockCreateUser.mockRejectedValue(
      new Error("Username or email already exists")
    );

    render(<UserForm />);

    // Fill form with valid data
    await user.type(screen.getByLabelText(/Username/), "testuser");
    await user.type(screen.getByLabelText(/Full Name/), "Test User");
    await user.type(screen.getByLabelText(/Email/), "test@example.com");
    await user.type(screen.getByLabelText(/Password/), "validpassword123");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /Create User/ });
    await user.click(submitButton);

    // Should map server error to both username and email fields
    await waitFor(() => {
      const errorMessages = screen.getAllByText(
        "Username or email already exists"
      );
      expect(errorMessages).toHaveLength(2); // One for username, one for email
    });
  });

  it("should validate phone number with exactly 10 digits", async () => {
    const user = userEvent.setup();
    render(<UserForm />);

    const phoneInput = screen.getByLabelText("Phone");

    // Test invalid phone numbers
    await user.type(phoneInput, "123456789"); // 9 digits
    await waitFor(() => {
      expect(
        screen.getByText("Phone number must be 10 digits")
      ).toBeInTheDocument();
    });

    await user.clear(phoneInput);
    await user.type(phoneInput, "12345678901"); // 11 digits
    await waitFor(() => {
      expect(
        screen.getByText("Phone number must be 10 digits")
      ).toBeInTheDocument();
    });

    // Test valid phone number
    await user.clear(phoneInput);
    await user.type(phoneInput, "1234567890"); // 10 digits
    await waitFor(() => {
      expect(
        screen.queryByText("Phone number must be 10 digits")
      ).not.toBeInTheDocument();
    });
  });

  it("should allow empty phone number", async () => {
    const user = userEvent.setup();
    render(<UserForm />);

    const phoneInput = screen.getByLabelText("Phone");

    // Leave phone empty (should be valid)
    await user.click(phoneInput);
    await user.tab(); // Move focus away to trigger validation

    await waitFor(() => {
      expect(
        screen.queryByText("Phone number must be 10 digits")
      ).not.toBeInTheDocument();
    });
  });
});
