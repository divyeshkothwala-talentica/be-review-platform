import { Book, User } from '../models';
import { logger } from './logger';

// Sample book data for seeding
const sampleBooks = [
  {
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    description: "A gripping, heart-wrenching, and wholly remarkable tale of coming-of-age in a South poisoned by virulent prejudice, it views a world of great beauty and savage inequities through the eyes of a young girl, as her father—a crusading local lawyer—risks everything to defend a black man unjustly accused of a terrible crime.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81aY1lxk+9L.jpg",
    genres: ["Fiction", "Drama"],
    publishedYear: 1960
  },
  {
    title: "1984",
    author: "George Orwell",
    description: "A dystopian social science fiction novel that follows the life of Winston Smith, a low-ranking member of 'the Party', who is frustrated by the omnipresent eyes of the party, and its ominous ruler Big Brother. 'Big Brother is watching you.'",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/91SZSW8qSsL.jpg",
    genres: ["Fiction", "Science Fiction"],
    publishedYear: 1949
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    description: "A romantic novel of manners written by Jane Austen. The novel follows the character development of Elizabeth Bennet, the dynamic protagonist of the book who learns about the repercussions of hasty judgments and comes to appreciate the difference between superficial goodness and actual goodness.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81NLDvyAHrL.jpg",
    genres: ["Fiction", "Romance"],
    publishedYear: 1813
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    description: "Set in the Jazz Age on prosperous Long Island and in New York City, the novel follows first-person narrator Nick Carraway's interactions with mysterious millionaire Jay Gatsby and Gatsby's obsession to reunite with his former lover, Daisy Buchanan.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81af+MCATTL.jpg",
    genres: ["Fiction", "Drama"],
    publishedYear: 1925
  },
  {
    title: "Harry Potter and the Philosopher's Stone",
    author: "J.K. Rowling",
    description: "The first novel in the Harry Potter series and Rowling's debut novel, it follows Harry Potter, a young wizard who discovers his magical heritage on his eleventh birthday, when he receives a letter of acceptance to Hogwarts School of Witchcraft and Wizardry.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81YOuOGFCJL.jpg",
    genres: ["Fantasy", "Young Adult"],
    publishedYear: 1997
  },
  {
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    description: "A novel about a few days in the life of 16-year-old Holden Caulfield after he has been expelled from prep school. Confused and disillusioned, Holden searches for truth and rails against the 'phoniness' of the adult world.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/8125BDk3l9L.jpg",
    genres: ["Fiction", "Young Adult"],
    publishedYear: 1951
  },
  {
    title: "Lord of the Flies",
    author: "William Golding",
    description: "A novel about a group of British boys stuck on an uninhabited island and their disastrous attempt to govern themselves. The novel examines controversial aspects of human nature and the tension between groupthink and individuality.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81WUAoL-wFL.jpg",
    genres: ["Fiction", "Adventure"],
    publishedYear: 1954
  },
  {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    description: "A children's fantasy novel about hobbit Bilbo Baggins, who joins the wizard Gandalf and thirteen dwarves on a quest to reclaim the lonely mountain and its treasure from the dragon Smaug.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/91b0C2YNSrL.jpg",
    genres: ["Fantasy", "Adventure"],
    publishedYear: 1937
  },
  {
    title: "Fahrenheit 451",
    author: "Ray Bradbury",
    description: "A dystopian novel set in a future American society where books are outlawed and 'firemen' burn any that are found. The novel presents a future American society where books are outlawed and 'firemen' burn any that are found.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81c2jzf2bsL.jpg",
    genres: ["Fiction", "Science Fiction"],
    publishedYear: 1953
  },
  {
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    description: "A novel that follows the experiences of its eponymous heroine, including her growth to adulthood and her love for Mr. Rochester, the brooding master of Thornfield Hall.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81bhsinTl9L.jpg",
    genres: ["Fiction", "Romance"],
    publishedYear: 1847
  },
  {
    title: "Brave New World",
    author: "Aldous Huxley",
    description: "A dystopian social science fiction novel set in a futuristic World State, whose citizens are environmentally engineered into an intelligence-based social hierarchy.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81p563e0AFL.jpg",
    genres: ["Fiction", "Science Fiction"],
    publishedYear: 1932
  },
  {
    title: "The Lord of the Rings: The Fellowship of the Ring",
    author: "J.R.R. Tolkien",
    description: "The first volume of the epic high fantasy novel. The story began as a sequel to Tolkien's 1937 fantasy novel The Hobbit, but eventually developed into a much larger work.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/91jBdG2aHML.jpg",
    genres: ["Fantasy", "Adventure"],
    publishedYear: 1954
  },
  {
    title: "Animal Farm",
    author: "George Orwell",
    description: "An allegorical novella that tells the story of a group of farm animals who rebel against their human farmer, hoping to create a society where the animals can be equal, free, and happy.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/91xuTBJCH6L.jpg",
    genres: ["Fiction", "Politics"],
    publishedYear: 1945
  },
  {
    title: "Wuthering Heights",
    author: "Emily Brontë",
    description: "The only novel by Emily Brontë, it tells the tale of the all-encompassing and passionate, yet thwarted, love between Heathcliff and Catherine Earnshaw, and how this unresolved passion eventually destroys them and many around them.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81H1FXuMvgL.jpg",
    genres: ["Fiction", "Romance"],
    publishedYear: 1847
  },
  {
    title: "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe",
    author: "C.S. Lewis",
    description: "A fantasy novel for children, it is the first published and best known of seven novels in The Chronicles of Narnia. Among all the author's books, it is also the most widely held in libraries.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81WdEdOCl5L.jpg",
    genres: ["Fantasy", "Children"],
    publishedYear: 1950
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    description: "Set in the distant future amidst a feudal interstellar society in which various noble houses control planetary fiefs, it tells the story of young Paul Atreides, whose family accepts the stewardship of the planet Arrakis.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81zN7udGRUL.jpg",
    genres: ["Science Fiction", "Adventure"],
    publishedYear: 1965
  },
  {
    title: "The Alchemist",
    author: "Paulo Coelho",
    description: "An allegorical novel that follows a young Andalusian shepherd in his journey to the pyramids of Egypt, after having a recurring dream of finding a treasure there.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81FPDKcHzJL.jpg",
    genres: ["Fiction", "Philosophy"],
    publishedYear: 1988
  },
  {
    title: "One Hundred Years of Solitude",
    author: "Gabriel García Márquez",
    description: "A landmark 1967 novel that tells the multi-generational story of the Buendía family, whose patriarch, José Arcadio Buendía, founded the town of Macondo in the Colombian countryside.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81MI6+TpYzL.jpg",
    genres: ["Fiction", "Drama"],
    publishedYear: 1967
  },
  {
    title: "The Kite Runner",
    author: "Khaled Hosseini",
    description: "The story of Amir, a young boy from the Wazir Akbar Khan district of Kabul, whose closest friend is Hassan. The story is set against a backdrop of tumultuous events, from the fall of Afghanistan's monarchy through the Soviet military intervention.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81IzbD2IiIL.jpg",
    genres: ["Fiction", "Drama"],
    publishedYear: 2003
  },
  {
    title: "Life of Pi",
    author: "Yann Martel",
    description: "A Canadian philosophical novel that tells the story of Pi Patel, a 16-year-old Indian boy stranded on a lifeboat in the Pacific Ocean with a Bengal tiger named Richard Parker.",
    coverImageUrl: "https://images-na.ssl-images-amazon.com/images/I/81SbBjj5vbL.jpg",
    genres: ["Fiction", "Adventure"],
    publishedYear: 2001
  }
];

// Sample admin users
const adminUsers = [
  {
    name: "Admin User",
    email: "admin@bookreview.com",
    password: "AdminPassword123!"
  },
  {
    name: "Content Manager",
    email: "content@bookreview.com",
    password: "ContentManager123!"
  }
];

// Function to seed books
export async function seedBooks(): Promise<void> {
  try {
    logger.info('Starting book seeding process...');
    
    // Check if books already exist
    const existingBooksCount = await Book.countDocuments();
    if (existingBooksCount > 0) {
      logger.info(`Database already contains ${existingBooksCount} books. Skipping book seeding.`);
      return;
    }

    // Insert sample books
    const createdBooks = await Book.insertMany(sampleBooks);
    logger.info(`Successfully seeded ${createdBooks.length} books to the database`);
    
    // Log some statistics
    const genreStats = await Book.aggregate([
      { $unwind: '$genres' },
      { $group: { _id: '$genres', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    logger.info('Book seeding statistics:');
    genreStats.forEach(stat => {
      logger.info(`  ${stat._id}: ${stat.count} books`);
    });
    
  } catch (error) {
    logger.error('Error seeding books:', error);
    throw error;
  }
}

// Function to seed admin users
export async function seedAdminUsers(): Promise<void> {
  try {
    logger.info('Starting admin user seeding process...');
    
    // Check if admin users already exist
    const existingAdmins = await User.find({ 
      email: { $in: adminUsers.map(user => user.email) } 
    });
    
    if (existingAdmins.length > 0) {
      logger.info(`Admin users already exist. Skipping admin user seeding.`);
      return;
    }

    // Create admin users
    const createdUsers = [];
    for (const userData of adminUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }
    
    logger.info(`Successfully seeded ${createdUsers.length} admin users to the database`);
    createdUsers.forEach(user => {
      logger.info(`  Created admin user: ${user.name} (${user.email})`);
    });
    
  } catch (error) {
    logger.error('Error seeding admin users:', error);
    throw error;
  }
}

// Function to seed all data
export async function seedAllData(): Promise<void> {
  try {
    logger.info('Starting complete database seeding process...');
    
    await seedBooks();
    await seedAdminUsers();
    
    logger.info('Database seeding completed successfully!');
    
    // Log final statistics
    const stats = {
      books: await Book.countDocuments(),
      users: await User.countDocuments(),
      reviews: 0, // No reviews seeded initially
      favorites: 0 // No favorites seeded initially
    };
    
    logger.info('Final database statistics:');
    logger.info(`  Books: ${stats.books}`);
    logger.info(`  Users: ${stats.users}`);
    logger.info(`  Reviews: ${stats.reviews}`);
    logger.info(`  Favorites: ${stats.favorites}`);
    
  } catch (error) {
    logger.error('Error during database seeding:', error);
    throw error;
  }
}

// Function to clear all data (useful for testing)
export async function clearAllData(): Promise<void> {
  try {
    logger.warn('Starting database clearing process...');
    
    await Promise.all([
      Book.deleteMany({}),
      User.deleteMany({}),
      // Note: Reviews and Favorites will be cleared automatically due to cascading
    ]);
    
    logger.warn('All data cleared from database');
    
  } catch (error) {
    logger.error('Error clearing database:', error);
    throw error;
  }
}

// Function to reset database (clear and reseed)
export async function resetDatabase(): Promise<void> {
  try {
    logger.info('Starting database reset process...');
    
    await clearAllData();
    await seedAllData();
    
    logger.info('Database reset completed successfully!');
    
  } catch (error) {
    logger.error('Error during database reset:', error);
    throw error;
  }
}
