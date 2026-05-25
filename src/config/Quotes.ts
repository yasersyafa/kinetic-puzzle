export interface Quote {
  text: string;
  author: string;
}

export const BRAIN_TRAINING_QUOTES: Quote[] = [
  {
    text: "The strategist must be able to see the end from the beginning.",
    author: "Sun Tzu",
  },
  {
    text: "Every move has a consequence. Strategy is knowing which ones you can live with.",
    author: "Garry Kasparov",
  },
  {
    text: "A puzzle is not a dead end, but a path waiting to be cleared.",
    author: "Ernő Rubik",
  },
  {
    text: "The walls are not there to stop you; they are there to make you think.",
    author: "Randy Pausch",
  },
  { text: "In life, as in chess, forethought wins.", author: "Charles Buxton" },
  {
    text: "Sometimes you have to take a step backward to move forward.",
    author: "Erika Taylor",
  },
  {
    text: "Efficiency is doing things right; effectiveness is doing the right things.",
    author: "Peter Drucker",
  },
  {
    text: "The hardest part of the puzzle is often the space you have the least of.",
    author: "Will Shortz",
  },
  {
    text: "First, solve the problem. Then, write the code—or make the move.",
    author: "John Johnson",
  },
  {
    text: "Constraints are the best friends of creativity and logic.",
    author: "Marissa Mayer",
  },
  {
    text: "Success is the result of many small, correct moves made in order.",
    author: "Bobby Fischer",
  },
  {
    text: "Complexity is your enemy. Any fool can make something complicated. It is hard to keep things simple.",
    author: "Richard Branson",
  },
  {
    text: "Focus on the sequence, not just the destination.",
    author: "Tim Ferriss",
  },
  {
    text: "Genius is the ability to reduce the complicated to the simple.",
    author: "C.W. Ceram",
  },
  {
    text: "Order and simplification are the first steps toward the mastery of a subject.",
    author: "Thomas Mann",
  },
  {
    text: "Great moves require both patience and the courage to commit.",
    author: "Magnus Carlsen",
  },
  {
    text: "Intelligence is the ability to adapt to change.",
    author: "Stephen Hawking",
  },
  {
    text: "The measure of intelligence is the ability to change your perspective.",
    author: "Albert Einstein",
  },
  {
    text: "Visualizing the solution is half the battle won.",
    author: "Dax Bamania",
  },
  { text: "Think eight times, move once.", author: "Japanese Proverb" },
  {
    text: "A problem well-stated is a problem half-solved.",
    author: "Charles Kettering",
  },
  {
    text: "Do not fear mistakes. You will know failure. Continue to reach out.",
    author: "Benjamin Franklin",
  },
  {
    text: "The shortest distance between two points is a straight line, but not always the smartest.",
    author: "Archimedes",
  },
  { text: "Precision is the soul of strategy.", author: "Miyamoto Musashi" },
  {
    text: "Logic is the tool that turns a mess into a masterpiece.",
    author: "Leonard Nimoy",
  },
];

export function getRandomQuote(): Quote {
  return BRAIN_TRAINING_QUOTES[
    Math.floor(Math.random() * BRAIN_TRAINING_QUOTES.length)
  ];
}
