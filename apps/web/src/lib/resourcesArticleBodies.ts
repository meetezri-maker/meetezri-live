/**
 * Full text for built-in reading-library articles (Resources page).
 * Keys match `WellnessBuiltinToolMeta.id` (without the `builtin:` prefix).
 */
export const RESOURCES_BUILTIN_ARTICLE_BODIES: Record<string, string> = {
  "grounding-54321": `Panic and anxiety often pull attention into “what if” thoughts. Grounding gently anchors you back to the present using your senses.

Find a comfortable seat. Take one slow breath in through your nose and out through your mouth.

Name five things you can see—small details are fine: light on the wall, the edge of a window, the texture of fabric.

Notice four things you can feel: feet on the floor, clothing on your skin, the chair supporting you, the temperature of the air.

Listen for three sounds you can hear right now, without judging them as good or bad.

If it is safe and available, notice two scents—coffee, soap, fresh air—or imagine two gentle smells you associate with calm.

Finally, name one taste you can sense, or take a sip of water and notice it.

Finish with three slow breaths. You can return to this sequence any time your nervous system needs a steady handrail.`,

  "stress-release-waves": `Stress often lives in the jaw, shoulders, and belly before we notice it mentally. This scan helps you soften tension in waves, paired with breath.

Sit or lie down with support. Close your eyes if that feels okay, or soften your gaze.

Inhale gently through your nose. As you exhale, imagine warmth spreading across your forehead and eyes, letting the muscles there soften.

On the next exhale, invite your jaw to unclench and your tongue to rest lightly in your mouth.

Breathe into your shoulders. On the out-breath, let them drop a fraction—no forcing, just permission.

Move attention down your arms to your hands. Open and close the fingers once, then let the hands rest heavy.

Notice your chest and upper back. With each exhale, imagine a little more space between your ribs.

Bring awareness to your belly. If it feels tight, place a hand there and breathe as if into your palm.

Scan hips, legs, and feet. Picture each exhale traveling down and out, like water finding the lowest point.

Stay for a few natural breaths. When you are ready, wiggle fingers and toes and return slowly.`,

  "body-scan": `A body scan is not about fixing anything—it is about meeting yourself with curiosity from head to toe.

Lie down or sit with your spine supported. Settle for a few breaths.

Bring attention to the top of your head. Notice any tingling, warmth, coolness, or neutrality—there is no wrong answer.

Gradually move down through your face, neck, and throat, spending a few breaths in each region without rushing.

When you reach your shoulders and arms, notice both sides without comparing them.

Continue through chest, upper back, and belly, allowing the breath to move on its own.

Explore hips, pelvis, and lower back with the same gentle attention.

Travel down each leg—thighs, knees, calves—and end at your feet and toes.

Take three full breaths for your whole body at once. Carry this sense of wholeness with you as you transition back to your day.`,

  gratitude: `Gratitude does not erase hard days, but it widens the lens so other truths can sit beside difficulty.

Take a quiet moment. You may write in a journal or simply think.

Name three specific things you are thankful for today. Small counts: hot water, a text from a friend, sunlight, a meal that tasted good.

For each one, add one sentence about why it mattered to you personally.

If a fourth or fifth example appears, welcome them—but three is enough.

Notice how your body responds as you linger on each item—there is no need to force a feeling.

Close by thanking yourself for taking this pause. You can repeat this practice whenever you want a steadier emotional footing.`,

  "compassion-pause": `When depression or shame is loud, a compassion pause offers language that is kinder than the inner critic.

Place a hand over your heart if that feels comforting.

Silently say: “This is a moment of pain.” That simple naming reduces the fight with reality.

Next: “Pain is part of being human—I am not alone in this.” You are connecting your experience to our shared humanity.

Then: “May I be kind to myself in this moment.” You are not asking for perfection—only gentleness.

Rest with those phrases for a few breaths. If your mind argues, notice that with curiosity and return to the third line.

When you are ready, lift your hand and take one deeper breath. You can shorten the pause to a single kind sentence on busy days—it still counts.`,

  "mindful-anchor": `Attention drifts—that is normal. An anchor breath gives you a simple place to return to.

Sit comfortably. Feel contact points where your body meets the chair or floor.

Choose an anchor: the feeling of air at your nostrils, or the rise and fall of your lower ribs.

For the next minute, each time you notice thinking, label it softly as “thinking,” and return to the anchor without scolding yourself.

Expand to three minutes if you wish, keeping the same rule: notice, name, return.

End by widening awareness to sounds in the room and the space around you.

Remember: every return to the anchor is a rep of mindfulness, not a failure. That is how the practice builds.`,
};

export function getBuiltinArticleBody(builtinIdWithoutPrefix: string): string | null {
  const body = RESOURCES_BUILTIN_ARTICLE_BODIES[builtinIdWithoutPrefix];
  return body ?? null;
}
