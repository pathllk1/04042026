/**
 * API endpoint for creating users
 */
import { defineEventHandler, readBody, createError } from 'h3';
import { getUserFromEvent } from '../../utils/auth';
import { requireManagerOrAdmin } from '../../utils/roleCheck';
import User from '../../models/User';
import bcrypt from 'bcryptjs';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initFirebase } from '../../utils/firebase';

export default defineEventHandler(async (event) => {
  try {
    // Only allow POST method
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        message: 'Method not allowed'
      });
    }

    // Get the authenticated user with manager or admin role
    const user = await requireManagerOrAdmin(event);

    const firmId = user.firmId.toString();

    // Get request body
    const body = await readBody(event);
    const { username, email, fullname, password, role = 'user' } = body;

    // Validate required fields
    if (!username || !email || !fullname || !password) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields: username, email, fullname, password'
      });
    }

    // Validate role
    const validRoles = ['user', 'manager', 'admin', 'sub-contractor'];
    if (!validRoles.includes(role)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid role. Must be one of: user, manager, admin, sub-contractor'
      });
    }

    // Check role-based permissions for creating specific user types
    if (role === 'sub-contractor' && user.role !== 'manager') {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: Only managers can create sub-contractor users'
      });
    }

    // Admins can create any type of user
    // Managers can create regular users and sub-contractors
    if (user.role === 'manager' && (role === 'admin' || role === 'manager')) {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: Managers can only create regular users and sub-contractors'
      });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [
        { username },
        { email }
      ]
    });

    if (existingUser) {
      throw createError({
        statusCode: 409,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      username,
      email,
      fullname,
      password: hashedPassword,
      role,
      firmId,
      status: 1 // Approved by default when created by manager/admin (status 1 means approved)
    });


    await newUser.save();

    // If the user is a sub-contractor, create a corresponding entry in the subsModels collection
    let subsModelId = null;
    if (role === 'sub-contractor') {
      try {
        // Initialize Firebase if not already initialized
        initFirebase();
        const db = getFirestore();
        const subsModelCollection = db.collection('subsModels');

        // Create new subs model document
        const now = Timestamp.now();
        const newSubsModel = {
          name: fullname, // Use the user's full name as the sub name
          contactInfo: {
            phone: null,
            email: email,
            address: null
          },
          balance: 0, // Start with zero balance
          firmId: firmId,
          userId: newUser._id.toString(), // Link to the MongoDB user ID
          isActive: true,
          createdAt: now,
          updatedAt: now
        };

        // Save to Firestore
        const docRef = await subsModelCollection.add(newSubsModel);
        subsModelId = docRef.id;
      } catch (firebaseError) {
        console.error('Error creating subsModel in Firestore:', firebaseError);
        // We don't want to fail the user creation if the subsModel creation fails
        // Just log the error and continue
      }
    }

    // Return success response
    return {
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullname: newUser.fullname,
        role: newUser.role,
        status: newUser.status
      },
      subsModelId: subsModelId // Include the subsModel ID if created
    };
  } catch (error) {
    console.error('Error in create user API:', error);

    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    });
  }
});
