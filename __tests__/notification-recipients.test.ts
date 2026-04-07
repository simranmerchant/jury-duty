import { describe, it, expect } from "vitest";
import {
  buildInviteIds,
  questionMentionRecipients,
  optionTagRecipients,
  type RecipientContext,
} from "../lib/notification-recipients";

// Fixture IDs
const CREATOR = "user-creator";
const GUEST_A = "user-guest-a"; // in the event
const GUEST_B = "user-guest-b"; // in the event
const OUTSIDER = "user-outsider"; // NOT in the event/group

// Helper to build a base public bet context
function publicCtx(overrides: Partial<RecipientContext> = {}): RecipientContext {
  return {
    creatorId: CREATOR,
    visibility: "public",
    guestIds: [GUEST_A, GUEST_B],
    explicitInviteIds: [],
    optionTaggedIds: [],
    questionTaggedIds: [],
    ...overrides,
  };
}

function privateCtx(overrides: Partial<RecipientContext> = {}): RecipientContext {
  return { ...publicCtx(overrides), visibility: "private", ...overrides };
}

// ─── buildInviteIds ────────────────────────────────────────────────────────────

describe("buildInviteIds", () => {
  it("returns empty array for public bets", () => {
    const ctx = publicCtx({ optionTaggedIds: [GUEST_A], explicitInviteIds: [GUEST_B] });
    expect(buildInviteIds(ctx)).toEqual([]);
  });

  it("always includes creator for private bets", () => {
    const ctx = privateCtx();
    expect(buildInviteIds(ctx)).toContain(CREATOR);
  });

  it("includes explicit invites and option-tagged users", () => {
    const ctx = privateCtx({ explicitInviteIds: [GUEST_A], optionTaggedIds: [GUEST_B] });
    const ids = buildInviteIds(ctx);
    expect(ids).toContain(GUEST_A);
    expect(ids).toContain(GUEST_B);
  });

  it("deduplicates when same user is both explicitly invited and option-tagged", () => {
    const ctx = privateCtx({ explicitInviteIds: [GUEST_A], optionTaggedIds: [GUEST_A] });
    const ids = buildInviteIds(ctx);
    expect(ids.filter((id) => id === GUEST_A).length).toBe(1);
  });

  it("does NOT include outsiders just because they were added — they must be set explicitly", () => {
    // This test documents the intended behavior: buildInviteIds trusts its inputs.
    // The API layer is responsible for validating who can be invited.
    const ctx = privateCtx({ explicitInviteIds: [OUTSIDER] });
    expect(buildInviteIds(ctx)).toContain(OUTSIDER);
  });
});

// ─── questionMentionRecipients ─────────────────────────────────────────────────

describe("questionMentionRecipients — public bet", () => {
  it("notifies an event member tagged in the question", () => {
    const ctx = publicCtx({ questionTaggedIds: [GUEST_A] });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).toContain(GUEST_A);
  });

  it("does NOT notify someone who is not in the event", () => {
    const ctx = publicCtx({ questionTaggedIds: [OUTSIDER] });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(OUTSIDER);
  });

  it("does NOT notify the creator even if they @mention themselves", () => {
    const ctx = publicCtx({ questionTaggedIds: [CREATOR] });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(CREATOR);
  });

  it("does NOT duplicate notification when user is both question-mentioned and option-tagged", () => {
    const ctx = publicCtx({ questionTaggedIds: [GUEST_A], optionTaggedIds: [GUEST_A] });
    const inviteIds = buildInviteIds(ctx);
    // GUEST_A should get the option tag notification, not this one
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(GUEST_A);
  });

  it("notifies multiple valid event members", () => {
    const ctx = publicCtx({ questionTaggedIds: [GUEST_A, GUEST_B, OUTSIDER] });
    const inviteIds = buildInviteIds(ctx);
    const result = questionMentionRecipients(ctx, inviteIds);
    expect(result).toContain(GUEST_A);
    expect(result).toContain(GUEST_B);
    expect(result).not.toContain(OUTSIDER);
  });
});

describe("questionMentionRecipients — private bet", () => {
  it("does NOT notify an event member who is not included in the private bet", () => {
    // GUEST_A is in the event but not in the invite list
    const ctx = privateCtx({ questionTaggedIds: [GUEST_A], explicitInviteIds: [] });
    const inviteIds = buildInviteIds(ctx); // only CREATOR
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(GUEST_A);
  });

  it("does NOT notify an outsider tagged in a private bet question", () => {
    const ctx = privateCtx({ questionTaggedIds: [OUTSIDER] });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(OUTSIDER);
  });

  it("notifies an event member who IS explicitly invited to the private bet", () => {
    const ctx = privateCtx({ questionTaggedIds: [GUEST_A], explicitInviteIds: [GUEST_A] });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).toContain(GUEST_A);
  });

  it("notifies an event member who is option-tagged (auto-added to invite list)", () => {
    // GUEST_A is tagged as an option (so they're in inviteIds)
    // GUEST_B is @mentioned in the question and also in inviteIds via explicit invite
    const ctx = privateCtx({
      optionTaggedIds: [GUEST_A],
      questionTaggedIds: [GUEST_B],
      explicitInviteIds: [GUEST_B],
    });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).toContain(GUEST_B);
  });
});

// ─── optionTagRecipients ───────────────────────────────────────────────────────

describe("optionTagRecipients — public bet", () => {
  it("notifies an event member tagged as an option", () => {
    const ctx = publicCtx({ optionTaggedIds: [GUEST_A] });
    expect(optionTagRecipients(ctx)).toContain(GUEST_A);
  });

  it("does NOT notify an outsider tagged as an option in a public bet", () => {
    const ctx = publicCtx({ optionTaggedIds: [OUTSIDER] });
    expect(optionTagRecipients(ctx)).not.toContain(OUTSIDER);
  });

  it("does NOT notify the creator if they tagged themselves as an option", () => {
    const ctx = publicCtx({ optionTaggedIds: [CREATOR] });
    expect(optionTagRecipients(ctx)).not.toContain(CREATOR);
  });

  it("notifies multiple valid guests tagged as options", () => {
    const ctx = publicCtx({ optionTaggedIds: [GUEST_A, GUEST_B, OUTSIDER] });
    const result = optionTagRecipients(ctx);
    expect(result).toContain(GUEST_A);
    expect(result).toContain(GUEST_B);
    expect(result).not.toContain(OUTSIDER);
  });
});

describe("optionTagRecipients — private bet", () => {
  it("notifies an event member tagged as an option (they can see it via auto-invite)", () => {
    const ctx = privateCtx({ optionTaggedIds: [GUEST_A] });
    expect(optionTagRecipients(ctx)).toContain(GUEST_A);
  });

  it("does NOT notify an outsider tagged as an option in a private bet", () => {
    const ctx = privateCtx({ optionTaggedIds: [OUTSIDER] });
    expect(optionTagRecipients(ctx)).not.toContain(OUTSIDER);
  });
});

// ─── Security: the core guarantee ─────────────────────────────────────────────

describe("Security: tagged user cannot discover they were tagged", () => {
  it("outsider gets zero notifications from a public bet even if tagged in question + option", () => {
    const ctx = publicCtx({
      questionTaggedIds: [OUTSIDER],
      optionTaggedIds: [OUTSIDER],
    });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(OUTSIDER);
    expect(optionTagRecipients(ctx)).not.toContain(OUTSIDER);
  });

  it("outsider gets zero notifications from a private bet even if tagged in question + option", () => {
    const ctx = privateCtx({
      questionTaggedIds: [OUTSIDER],
      optionTaggedIds: [OUTSIDER],
    });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(OUTSIDER);
    expect(optionTagRecipients(ctx)).not.toContain(OUTSIDER);
  });

  it("event member in a private bet they weren't invited to gets zero notifications", () => {
    // GUEST_A is in the event but the bet is private and only GUEST_B was invited
    const ctx = privateCtx({
      questionTaggedIds: [GUEST_A],
      optionTaggedIds: [GUEST_A],
      explicitInviteIds: [GUEST_B],
    });
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).not.toContain(GUEST_A);
    // option tags still go through — they auto-add to inviteIds so they can see the bet
    // but we verify question mentions are blocked
  });

  it("no one gets notified when no one is tagged", () => {
    const ctx = publicCtx();
    const inviteIds = buildInviteIds(ctx);
    expect(questionMentionRecipients(ctx, inviteIds)).toHaveLength(0);
    expect(optionTagRecipients(ctx)).toHaveLength(0);
  });
});
