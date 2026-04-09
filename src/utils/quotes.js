// 30 curated daily inspirational quotes – health, wellness, self-compassion
const quotes = [
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Progress, not perfection, is what we should be asking of ourselves.", author: "Julia Cameron" },
  { text: "Nourishing yourself in a way that helps you blossom in the direction you want to go is attainable, and you are worth the effort.", author: "Deborah Day" },
  { text: "The groundwork for all happiness is good health.", author: "Leigh Hunt" },
  { text: "Caring for myself is not self-indulgence, it is self-preservation.", author: "Audre Lorde" },
  { text: "You don't have to eat less. You just have to eat right.", author: "Unknown" },
  { text: "Every day is a chance to begin again. Don't focus on the failures of yesterday, start today with positive thoughts.", author: "Catherine Pulsifer" },
  { text: "A healthy outside starts from the inside.", author: "Robert Urich" },
  { text: "Small steps every day lead to big changes over time.", author: "Unknown" },
  { text: "Your body hears everything your mind says. Stay positive.", author: "Unknown" },
  { text: "The food you eat can be either the safest and most powerful form of medicine or the slowest form of poison.", author: "Ann Wigmore" },
  { text: "Be gentle with yourself. You're doing the best you can.", author: "Unknown" },
  { text: "One meal at a time. One day at a time. You've got this.", author: "Unknown" },
  { text: "Wellness is not a destination – it's a daily practice.", author: "Unknown" },
  { text: "You are worthy of the time it takes to do the things that heal you.", author: "Maryam Hasnaa" },
  { text: "Let food be thy medicine and medicine be thy food.", author: "Hippocrates" },
  { text: "It is health that is real wealth, and not pieces of gold and silver.", author: "Mahatma Gandhi" },
  { text: "Rest when you need to, but don't give up.", author: "Unknown" },
  { text: "Don't dig your grave with your own knife and fork.", author: "English Proverb" },
  { text: "The greatest wealth is health.", author: "Virgil" },
  { text: "Happiness is the highest form of health.", author: "Dalai Lama" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "Your health is an investment, not an expense.", author: "Unknown" },
  { text: "Eat well, move daily, hydrate often, sleep lots, love your body.", author: "Unknown" },
  { text: "To keep the body in good health is a duty, otherwise we shall not be able to keep our mind strong and clear.", author: "Buddha" },
  { text: "When you feel like quitting, think about why you started.", author: "Unknown" },
  { text: "You are enough, just as you are.", author: "Meghan Markle" },
  { text: "Celebrate every tiny victory. They add up.", author: "Unknown" },
  { text: "Self-care is giving the world the best of you, instead of what's left of you.", author: "Katie Reed" },
  { text: "What you eat today walks and talks tomorrow.", author: "Unknown" },
];

export function getDailyQuote() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return quotes[dayOfYear % quotes.length];
}

export default quotes;
