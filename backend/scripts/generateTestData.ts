#!/usr/bin/env ts-node

import database from '../src/config/database';
import { Book, User, Review, Favorite } from '../src/models';
import { VALID_GENRES } from '../src/models/Book';
import { logger } from '../src/utils/logger';

// Extended book data for 200 books
const bookTitles = [
  "To Kill a Mockingbird", "1984", "Pride and Prejudice", "The Great Gatsby", "Harry Potter and the Philosopher's Stone",
  "The Catcher in the Rye", "Lord of the Flies", "The Hobbit", "Fahrenheit 451", "Jane Eyre",
  "Brave New World", "The Lord of the Rings: The Fellowship of the Ring", "Animal Farm", "Wuthering Heights",
  "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe", "Dune", "The Alchemist", "One Hundred Years of Solitude",
  "The Kite Runner", "Life of Pi", "The Da Vinci Code", "Gone Girl", "The Girl with the Dragon Tattoo",
  "The Hunger Games", "Twilight", "The Fault in Our Stars", "The Book Thief", "The Help",
  "Where the Crawdads Sing", "Educated", "Becoming", "Sapiens", "The Silent Patient", "Little Fires Everywhere",
  "Normal People", "Circe", "The Seven Husbands of Evelyn Hugo", "Eleanor Oliphant Is Completely Fine",
  "A Gentleman in Moscow", "The Nightingale", "All the Light We Cannot See", "The Goldfinch",
  "The Handmaid's Tale", "Beloved", "The Color Purple", "Their Eyes Were Watching God", "Invisible Man",
  "The Sun Also Rises", "For Whom the Bell Tolls", "Of Mice and Men", "The Grapes of Wrath",
  "East of Eden", "Slaughterhouse-Five", "Catch-22", "The Things They Carried", "One Flew Over the Cuckoo's Nest",
  "To the Lighthouse", "Mrs. Dalloway", "Ulysses", "The Sound and the Fury", "As I Lay Dying",
  "Light in August", "Absalom, Absalom!", "The Heart Is a Lonely Hunter", "The Member of the Wedding",
  "A Streetcar Named Desire", "Death of a Salesman", "The Crucible", "Long Day's Journey Into Night",
  "Who's Afraid of Virginia Woolf?", "The Glass Menagerie", "Cat on a Hot Tin Roof", "A Raisin in the Sun",
  "Fences", "The Piano Lesson", "Ma Rainey's Black Bottom", "Joe Turner's Come and Gone",
  "Two Trains Running", "Seven Guitars", "Jitney", "King Hedley II", "Gem of the Ocean", "Radio Golf",
  "The Iceman Cometh", "Strange Interlude", "Mourning Becomes Electra", "Ah, Wilderness!", "The Emperor Jones",
  "The Hairy Ape", "Anna Christie", "Beyond the Horizon", "Desire Under the Elms", "The Great God Brown",
  "Marco Millions", "Lazarus Laughed", "Dynamo", "Days Without End", "A Touch of the Poet",
  "More Stately Mansions", "A Moon for the Misbegotten", "Hughie", "The Last Conquest", "Chris Christophersen",
  "Shell Shock", "The Personal Equation", "Now I Ask You", "In the Zone", "Ile", "The Long Voyage Home",
  "The Moon of the Caribbees", "Bound East for Cardiff", "The Rope", "Where the Cross Is Made",
  "Gold", "Anna Christie", "Diff'rent", "The First Man", "The Fountain", "Welded", "All God's Chillun Got Wings",
  "S.S. Glencairn", "The Ancient Mariner", "Lazarus Laughed", "Strange Interlude", "Dynamo",
  "Mourning Becomes Electra", "Ah, Wilderness!", "Days Without End", "The Iceman Cometh", "A Moon for the Misbegotten",
  "Long Day's Journey Into Night", "A Touch of the Poet", "More Stately Mansions", "Hughie",
  "The Metamorphosis", "The Trial", "The Castle", "Amerika", "In the Penal Colony", "A Hunger Artist",
  "The Judgment", "A Country Doctor", "The Great Wall of China", "Investigations of a Dog",
  "The Burrow", "Josephine the Singer", "A Report to an Academy", "The Bucket Rider",
  "A Fratricide", "An Old Manuscript", "Before the Law", "In the Gallery", "A Dream",
  "Up in the Gallery", "The Wish to Be a Red Indian", "The Trees", "Clothes", "The Passenger",
  "Rejection", "Reflections for Gentlemen-Jockeys", "The Street Window", "Excursion into the Mountains",
  "Bachelor's Ill Luck", "The Merchant", "Absent-minded Window-gazing", "The Way Home",
  "Passers-by", "On the Tram", "Children on a Country Road", "Unmasking a Confidence Trickster",
  "The Sudden Walk", "Resolutions", "The Wish to Be a Red Indian", "Wedding Preparations in the Country",
  "Description of a Struggle", "The Village Schoolmaster", "Blumfeld, an Elderly Bachelor",
  "The Warden of the Tomb", "A Report to an Academy", "The Hunter Gracchus", "The Great Wall of China",
  "A Message from the Emperor", "The Silence of the Sirens", "Prometheus", "The City Coat of Arms",
  "Poseidon", "Fellowship", "At Night", "The Problem of Our Laws", "The Conscription of Troops",
  "The Test", "The Vulture", "The Helmsman", "The Top", "A Little Fable", "Home-Coming",
  "First Sorrow", "A Little Woman", "A Hunger Artist", "Investigations of a Dog", "A Country Doctor",
  "An Imperial Message", "The New Advocate", "A Country Doctor", "Up in the Gallery", "An Old Manuscript",
  "Before the Law", "Jackals and Arabs", "A Visit to a Mine", "The Next Village", "An Imperial Message",
  "The Cares of a Family Man", "Eleven Sons", "A Fratricide", "A Dream", "A Report to an Academy"
];

const authors = [
  "Harper Lee", "George Orwell", "Jane Austen", "F. Scott Fitzgerald", "J.K. Rowling",
  "J.D. Salinger", "William Golding", "J.R.R. Tolkien", "Ray Bradbury", "Charlotte Brontë",
  "Aldous Huxley", "Emily Brontë", "C.S. Lewis", "Frank Herbert", "Paulo Coelho",
  "Gabriel García Márquez", "Khaled Hosseini", "Yann Martel", "Dan Brown", "Gillian Flynn",
  "Stieg Larsson", "Suzanne Collins", "Stephenie Meyer", "John Green", "Markus Zusak",
  "Kathryn Stockett", "Delia Owens", "Tara Westover", "Michelle Obama", "Yuval Noah Harari",
  "Alex Michaelides", "Celeste Ng", "Sally Rooney", "Madeline Miller", "Taylor Jenkins Reid",
  "Gail Honeyman", "Amor Towles", "Kristin Hannah", "Anthony Doerr", "Donna Tartt",
  "Margaret Atwood", "Toni Morrison", "Alice Walker", "Zora Neale Hurston", "Ralph Ellison",
  "Ernest Hemingway", "John Steinbeck", "Kurt Vonnegut", "Joseph Heller", "Tim O'Brien",
  "Ken Kesey", "Virginia Woolf", "James Joyce", "William Faulkner", "Carson McCullers",
  "Tennessee Williams", "Arthur Miller", "Eugene O'Neill", "August Wilson", "Sam Shepard",
  "David Mamet", "Tony Kushner", "Suzan-Lori Parks", "Lynn Nottage", "Annie Baker",
  "Franz Kafka", "Jorge Luis Borges", "Italo Calvino", "Milan Kundera", "Salman Rushdie",
  "Chinua Achebe", "Wole Soyinka", "Ngugi wa Thiong'o", "Chimamanda Ngozi Adichie", "Buchi Emecheta"
];

const userNames = [
  "Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Emma Brown", "Frank Miller",
  "Grace Taylor", "Henry Anderson", "Ivy Thomas", "Jack Jackson", "Kate White", "Liam Harris",
  "Mia Martin", "Noah Thompson", "Olivia Garcia", "Paul Martinez", "Quinn Robinson", "Ruby Clark",
  "Sam Rodriguez", "Tina Lewis", "Uma Walker", "Victor Hall", "Wendy Allen", "Xavier Young",
  "Yara Hernandez", "Zoe King", "Adam Wright", "Bella Lopez", "Chris Hill", "Diana Scott",
  "Ethan Green", "Fiona Adams", "George Baker", "Hannah Gonzalez", "Ian Nelson", "Julia Carter",
  "Kevin Mitchell", "Luna Perez", "Mason Roberts", "Nora Turner", "Oscar Phillips", "Penny Campbell",
  "Quincy Parker", "Rose Evans", "Simon Edwards", "Tara Collins", "Ulysses Stewart", "Vera Sanchez",
  "Wade Morris", "Xara Rogers"
];

// Function to generate random description
function generateDescription(title: string, author: string): string {
  const descriptions = [
    `A masterful work by ${author} that explores the depths of human nature through the story of ${title}. This compelling narrative weaves together themes of love, loss, and redemption in ways that will leave readers questioning their own beliefs and values.`,
    `${author}'s brilliant ${title} is a tour de force that captures the essence of the human experience. With vivid characters and intricate plotting, this novel delves into the complexities of modern life while maintaining a timeless appeal that resonates with readers across generations.`,
    `In ${title}, ${author} crafts an unforgettable tale that combines literary excellence with emotional depth. This powerful story examines the intricacies of relationships, society, and personal growth, offering insights that linger long after the final page is turned.`,
    `${author} delivers a stunning achievement with ${title}, a work that seamlessly blends compelling storytelling with profound philosophical insights. This remarkable novel challenges readers to examine their assumptions while providing an entertaining and thought-provoking reading experience.`,
    `A captivating exploration of the human condition, ${title} by ${author} stands as a testament to the power of great literature. Through richly developed characters and masterful prose, this novel addresses universal themes that speak to the heart of what it means to be human.`
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

// Function to generate random cover image URL
function generateCoverImageUrl(): string {
  const imageIds = Array.from({length: 100}, (_, i) => 100 + i);
  const randomId = imageIds[Math.floor(Math.random() * imageIds.length)];
  return `https://picsum.photos/400/600?random=${randomId}`;
}

// Function to generate random genres (1-3 genres per book)
function generateRandomGenres(): string[] {
  const shuffled = [...VALID_GENRES].sort(() => 0.5 - Math.random());
  const count = Math.floor(Math.random() * 3) + 1; // 1-3 genres
  return shuffled.slice(0, count);
}

// Function to generate random year between 1900 and 2024
function generateRandomYear(): number {
  return Math.floor(Math.random() * (2024 - 1900 + 1)) + 1900;
}

// Function to generate 200 books
async function generateBooks(): Promise<any[]> {
  logger.info('Generating 200 books...');
  
  const books = [];
  for (let i = 0; i < 200; i++) {
    const title = bookTitles[i] || `Book Title ${i + 1}`;
    const author = authors[Math.floor(Math.random() * authors.length)];
    
    books.push({
      title,
      author,
      description: generateDescription(title, author),
      coverImageUrl: generateCoverImageUrl(),
      genres: generateRandomGenres(),
      publishedYear: generateRandomYear(),
      averageRating: 0,
      totalReviews: 0
    });
  }
  
  return books;
}

// Function to generate 50 users
async function generateUsers(): Promise<any[]> {
  logger.info('Generating 50 users...');
  
  const users = [];
  for (let i = 0; i < 50; i++) {
    const name = userNames[i] || `User ${i + 1}`;
    const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;
    
    users.push({
      name,
      email,
      password: 'TestPassword123!' // All test users have the same password for simplicity
    });
  }
  
  return users;
}

// Function to generate random review text
function generateReviewText(): string {
  const reviews = [
    "This book completely captivated me from the first page. The author's writing style is engaging and the characters feel incredibly real. I couldn't put it down!",
    "An absolutely brilliant piece of literature. The themes explored are both timeless and relevant to today's world. Highly recommend to anyone looking for a thought-provoking read.",
    "I found this book to be quite enjoyable, though it took a while to get into the story. The second half really picked up and made the slow start worth it.",
    "Not quite what I expected, but in the best possible way. The author surprised me with unexpected plot twists and deep character development.",
    "A solid read with beautiful prose and well-developed characters. While not groundbreaking, it's definitely worth your time if you enjoy this genre.",
    "This book left me speechless. The emotional depth and complexity of the story is remarkable. It's one of those books that stays with you long after you finish reading.",
    "I have mixed feelings about this one. There were parts I absolutely loved, but other sections felt a bit slow. Overall, still a worthwhile read.",
    "Fantastic storytelling! The author has a gift for creating vivid scenes and memorable characters. This is definitely going on my list of favorites.",
    "While the premise was interesting, I felt the execution could have been better. The pacing was uneven and some plot points felt rushed.",
    "An incredible journey from start to finish. This book challenged my perspectives and made me think about things in new ways. Truly transformative.",
    "Good book overall, but I felt it could have been shorter. Some parts dragged on longer than necessary, though the ending was satisfying.",
    "This is exactly the kind of book I love - complex characters, intricate plot, and beautiful writing. The author has quickly become one of my favorites.",
    "I appreciated the unique perspective and fresh take on familiar themes. While not perfect, it's definitely a book that stands out from the crowd.",
    "Couldn't get into this one despite multiple attempts. The writing style just didn't click with me, though I can see why others might enjoy it.",
    "A masterpiece of modern literature. Every page is crafted with care and attention to detail. This book deserves all the praise it has received."
  ];
  
  return reviews[Math.floor(Math.random() * reviews.length)];
}

// Function to generate 1000 reviews
async function generateReviews(users: any[], books: any[]): Promise<any[]> {
  logger.info('Generating 1000 reviews...');
  
  const reviews = [];
  const userBookPairs = new Set<string>();
  
  for (let i = 0; i < 1000; i++) {
    let userId, bookId, pairKey;
    
    // Ensure unique user-book pairs
    do {
      userId = users[Math.floor(Math.random() * users.length)]._id;
      bookId = books[Math.floor(Math.random() * books.length)]._id;
      pairKey = `${userId}-${bookId}`;
    } while (userBookPairs.has(pairKey));
    
    userBookPairs.add(pairKey);
    
    reviews.push({
      userId,
      bookId,
      text: generateReviewText(),
      rating: Math.floor(Math.random() * 5) + 1, // 1-5 rating
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date within last year
    });
  }
  
  return reviews;
}

// Function to generate 700 favorites
async function generateFavorites(users: any[], books: any[]): Promise<any[]> {
  logger.info('Generating 700 favorites...');
  
  const favorites = [];
  const userBookPairs = new Set<string>();
  
  for (let i = 0; i < 700; i++) {
    let userId, bookId, pairKey;
    
    // Ensure unique user-book pairs
    do {
      userId = users[Math.floor(Math.random() * users.length)]._id;
      bookId = books[Math.floor(Math.random() * books.length)]._id;
      pairKey = `${userId}-${bookId}`;
    } while (userBookPairs.has(pairKey));
    
    userBookPairs.add(pairKey);
    
    favorites.push({
      userId,
      bookId,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date within last year
    });
  }
  
  return favorites;
}

// Function to update book statistics based on reviews
async function updateBookStatistics(): Promise<void> {
  logger.info('Updating book statistics...');
  
  const books = await Book.find();
  
  for (const book of books) {
    const reviews = await Review.find({ bookId: book._id });
    
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;
      
      await Book.findByIdAndUpdate(book._id, {
        averageRating,
        totalReviews: reviews.length
      });
    }
  }
}

// Function to clear all existing data
async function clearAllData(): Promise<void> {
  logger.warn('Clearing all existing data...');
  
  await Promise.all([
    Book.deleteMany({}),
    User.deleteMany({}),
    Review.deleteMany({}),
    Favorite.deleteMany({})
  ]);
  
  logger.warn('All data cleared from database');
}

// Main function to generate all test data
async function generateAllTestData(): Promise<void> {
  try {
    logger.info('Starting comprehensive test data generation...');
    
    // Clear existing data
    await clearAllData();
    
    // Generate and insert books
    const bookData = await generateBooks();
    const createdBooks = await Book.insertMany(bookData);
    logger.info(`✅ Created ${createdBooks.length} books`);
    
    // Generate and insert users
    const userData = await generateUsers();
    const createdUsers = await User.insertMany(userData);
    logger.info(`✅ Created ${createdUsers.length} users`);
    
    // Generate and insert reviews
    const reviewData = await generateReviews(createdUsers, createdBooks);
    const createdReviews = await Review.insertMany(reviewData);
    logger.info(`✅ Created ${createdReviews.length} reviews`);
    
    // Generate and insert favorites
    const favoriteData = await generateFavorites(createdUsers, createdBooks);
    const createdFavorites = await Favorite.insertMany(favoriteData);
    logger.info(`✅ Created ${createdFavorites.length} favorites`);
    
    // Update book statistics
    await updateBookStatistics();
    logger.info('✅ Updated book statistics');
    
    // Log final statistics
    const finalStats = {
      books: await Book.countDocuments(),
      users: await User.countDocuments(),
      reviews: await Review.countDocuments(),
      favorites: await Favorite.countDocuments()
    };
    
    logger.info('🎉 Test data generation completed successfully!');
    logger.info('📊 Final database statistics:');
    logger.info(`   📚 Books: ${finalStats.books}`);
    logger.info(`   👥 Users: ${finalStats.users}`);
    logger.info(`   📝 Reviews: ${finalStats.reviews}`);
    logger.info(`   ❤️  Favorites: ${finalStats.favorites}`);
    
    // Additional statistics
    const avgRating = await Book.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$averageRating' } } }
    ]);
    
    const genreStats = await Book.aggregate([
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    logger.info(`📈 Average book rating: ${avgRating[0]?.avgRating?.toFixed(2) || 0}`);
    logger.info('🏷️  Top 5 genres:');
    genreStats.forEach(stat => {
      logger.info(`   ${stat._id}: ${stat.count} books`);
    });
    
  } catch (error) {
    logger.error('❌ Error during test data generation:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'generate';

async function runScript() {
  try {
    // Connect to database
    logger.info('🔌 Connecting to database...');
    await database.connect();
    
    switch (command) {
      case 'generate':
        await generateAllTestData();
        break;
        
      case 'clear':
        await clearAllData();
        logger.info('✅ Database cleared successfully');
        break;
        
      default:
        logger.error(`❌ Unknown command: ${command}`);
        logger.info('Available commands: generate, clear');
        process.exit(1);
    }
    
  } catch (error) {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    try {
      await database.disconnect();
      logger.info('🔌 Database connection closed');
    } catch (error) {
      logger.error('❌ Error closing database connection:', error);
    }
    
    process.exit(0);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { promise, reason });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  process.exit(1);
});

// Run the script
runScript();
