import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import config from '../config';

const router = Router();

// Health check routes (no versioning needed)
router.use('/health', healthRoutes);

// API versioned routes
const apiRouter = Router();

// Mount API routes under version prefix
router.use(`/${config.apiVersion}`, apiRouter);

// Authentication routes
apiRouter.use('/auth', authRoutes);

// Route imports
import bookRoutes from './books';
// import reviewRoutes from './reviews';
// import favoriteRoutes from './favorites';
// import userRoutes from './users';
// import recommendationRoutes from './recommendations';

// Route mounting
apiRouter.use('/books', bookRoutes);
// apiRouter.use('/reviews', reviewRoutes);
// apiRouter.use('/favorites', favoriteRoutes);
// apiRouter.use('/users', userRoutes);
// apiRouter.use('/recommendations', recommendationRoutes);

export default router;
