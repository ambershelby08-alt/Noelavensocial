export interface User {
  id: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  interests: string[];
  followers: number;
  following: number;
  postCount: number;
  badges: string[];
  pinnedPostId?: string;
  joinedAt: Date;
}

export interface Post {
  id: string;
  authorId: string;
  author: User;
  content: string;
  imageUrl?: string;
  communityId?: string;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  mood?: string;
  createdAt: Date;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  memberCount: number;
  category: string;
  rules: string[];
  moderatorIds: string[];
  isJoined: boolean;
  isPrivate: boolean;
  createdAt: Date;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  imageUrl?: string;
  type: 'text' | 'image' | 'voice';
  reactions: Record<string, string[]>;
  readBy: string[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: User[];
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'community_invite' | 'daily_spark';
  actorId: string;
  actor: User;
  postId?: string;
  communityId?: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export const mockUsers: User[] = [
  {
    id: "user-1",
    displayName: "Alice Wonderland",
    handle: "alice_w",
    bio: "Exploring the rabbit holes of design and code. 🎨✨",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alice",
    coverUrl: "https://picsum.photos/800/300?random=1",
    interests: ["Design", "Technology", "Art"],
    followers: 1240,
    following: 340,
    postCount: 156,
    badges: ["Early Adopter", "Top Creator"],
    joinedAt: new Date(Date.now() - 10000000000)
  },
  {
    id: "user-2",
    displayName: "Bob Builder",
    handle: "bob_builds",
    bio: "I build things. Usually they work. 🛠️",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Bob",
    coverUrl: "https://picsum.photos/800/300?random=2",
    interests: ["Engineering", "DIY", "Gaming"],
    followers: 890,
    following: 120,
    postCount: 45,
    badges: ["Community Builder"],
    joinedAt: new Date(Date.now() - 5000000000)
  },
  {
    id: "demo-user",
    displayName: "Jane Doe",
    handle: "janedoe",
    bio: "Living my best life in color. 🌈 Welcome to Noelaven!",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Jane",
    coverUrl: "https://picsum.photos/800/300?random=3",
    interests: ["Photography", "Travel", "Music"],
    followers: 5430,
    following: 432,
    postCount: 230,
    badges: ["Verified", "Top Creator", "Early Adopter"],
    joinedAt: new Date(Date.now() - 20000000000)
  },
  {
    id: "user-4",
    displayName: "Charlie Chaplin",
    handle: "charlie_c",
    bio: "Silent but deadly... at coding. 🤫💻",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Charlie",
    coverUrl: "https://picsum.photos/800/300?random=4",
    interests: ["Comedy", "Film", "Coding"],
    followers: 2100,
    following: 50,
    postCount: 89,
    badges: [],
    joinedAt: new Date(Date.now() - 8000000000)
  },
  {
    id: "user-5",
    displayName: "Diana Prince",
    handle: "wonder_diana",
    bio: "Saving the world one line of code at a time.",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=Diana",
    coverUrl: "https://picsum.photos/800/300?random=5",
    interests: ["Fitness", "Justice", "Reading"],
    followers: 9800,
    following: 12,
    postCount: 412,
    badges: ["Hero", "Verified"],
    joinedAt: new Date(Date.now() - 30000000000)
  }
];

export const mockPosts: Post[] = [
  {
    id: "post-1",
    authorId: "user-1",
    author: mockUsers[0],
    content: "Just finished redesigning my portfolio! What do you guys think? The new gradient vibes are everything.",
    imageUrl: "https://picsum.photos/600/400?random=11",
    likes: 342,
    comments: 45,
    shares: 12,
    liked: false,
    saved: false,
    mood: "Excited",
    createdAt: new Date(Date.now() - 3600000 * 2)
  },
  {
    id: "post-2",
    authorId: "user-2",
    author: mockUsers[1],
    content: "Finally got that pesky bug fixed. Turns out it was just a missing semicolon. Typical! 😅",
    likes: 120,
    comments: 8,
    shares: 2,
    liked: true,
    saved: true,
    mood: "Relieved",
    communityId: "comm-1",
    createdAt: new Date(Date.now() - 3600000 * 5)
  },
  {
    id: "post-3",
    authorId: "user-4",
    author: mockUsers[3],
    content: "Watching old movies all day today. Nothing beats black and white classics.",
    imageUrl: "https://picsum.photos/600/400?random=13",
    likes: 89,
    comments: 12,
    shares: 4,
    liked: false,
    saved: false,
    mood: "Chill",
    createdAt: new Date(Date.now() - 3600000 * 24)
  },
  {
    id: "post-4",
    authorId: "demo-user",
    author: mockUsers[2],
    content: "Golden hour hits different today. Caught this beauty on my evening walk.",
    imageUrl: "https://picsum.photos/600/400?random=14",
    likes: 1540,
    comments: 123,
    shares: 45,
    liked: true,
    saved: false,
    mood: "Happy",
    createdAt: new Date(Date.now() - 3600000 * 48)
  },
  {
    id: "post-5",
    authorId: "user-5",
    author: mockUsers[4],
    content: "Just crushed my morning workout! Remember, consistency is key.",
    likes: 450,
    comments: 20,
    shares: 5,
    liked: false,
    saved: true,
    mood: "Energetic",
    communityId: "comm-6",
    createdAt: new Date(Date.now() - 3600000 * 72)
  },
  {
    id: "post-6",
    authorId: "demo-user",
    author: mockUsers[2],
    content: "Spent the weekend exploring the botanical gardens. There's something magical about slowing down and noticing the details we usually walk past. 🌸",
    imageUrl: "https://picsum.photos/600/400?random=31",
    likes: 892,
    comments: 67,
    shares: 23,
    liked: false,
    saved: true,
    mood: "Peaceful",
    createdAt: new Date(Date.now() - 3600000 * 96)
  },
  {
    id: "post-7",
    authorId: "demo-user",
    author: mockUsers[2],
    content: "New camera gear arrived today and I immediately took it to the rooftop. The city looks completely different from up here. Obsessed. 🏙️📷",
    imageUrl: "https://picsum.photos/600/400?random=42",
    likes: 2340,
    comments: 198,
    shares: 87,
    liked: true,
    saved: false,
    mood: "Excited",
    createdAt: new Date(Date.now() - 3600000 * 120)
  },
  {
    id: "post-8",
    authorId: "user-1",
    author: mockUsers[0],
    content: "Color theory is not just for designers — it's for everyone who wants to communicate better. Here's what I learned this week about using complementary palettes in UI. 🎨",
    likes: 511,
    comments: 38,
    shares: 19,
    liked: false,
    saved: false,
    mood: "Inspired",
    communityId: "comm-1",
    createdAt: new Date(Date.now() - 3600000 * 30)
  }
];

export const mockCommunities: Community[] = [
  {
    id: "comm-1",
    name: "Design Mavericks",
    description: "A place for bold designers to share and critique work.",
    bannerUrl: "https://picsum.photos/800/300?random=21",
    memberCount: 15400,
    category: "Design",
    rules: ["Be kind", "Give constructive feedback", "No spam"],
    moderatorIds: ["user-1", "demo-user"],
    isJoined: true,
    isPrivate: false,
    createdAt: new Date()
  },
  {
    id: "comm-2",
    name: "Tech Enthusiasts",
    description: "Latest gadgets, code, and tech news.",
    bannerUrl: "https://picsum.photos/800/300?random=22",
    memberCount: 8900,
    category: "Technology",
    rules: ["Tech only", "No politics"],
    moderatorIds: ["user-2"],
    isJoined: false,
    isPrivate: false,
    createdAt: new Date()
  },
  {
    id: "comm-3",
    name: "Photography Lovers",
    description: "Share your best shots and learn new techniques.",
    bannerUrl: "https://picsum.photos/800/300?random=23",
    memberCount: 23000,
    category: "Photography",
    rules: ["Original content only", "Include EXIF data if possible"],
    moderatorIds: ["demo-user"],
    isJoined: true,
    isPrivate: false,
    createdAt: new Date()
  },
  {
    id: "comm-4",
    name: "Indie Music Scene",
    description: "Discover and share independent artists.",
    bannerUrl: "https://picsum.photos/800/300?random=24",
    memberCount: 5600,
    category: "Music",
    rules: ["Support artists", "No piracy"],
    moderatorIds: ["user-4"],
    isJoined: false,
    isPrivate: false,
    createdAt: new Date()
  },
  {
    id: "comm-5",
    name: "Wanderlust",
    description: "Travel stories, tips, and breathtaking photos.",
    bannerUrl: "https://picsum.photos/800/300?random=25",
    memberCount: 42000,
    category: "Travel",
    rules: ["Share locations responsibly", "Be respectful of cultures"],
    moderatorIds: ["user-1", "user-5"],
    isJoined: true,
    isPrivate: false,
    createdAt: new Date()
  },
  {
    id: "comm-6",
    name: "Fit & Healthy",
    description: "Workouts, nutrition, and wellness.",
    bannerUrl: "https://picsum.photos/800/300?random=26",
    memberCount: 12500,
    category: "Fitness",
    rules: ["No medical advice", "Encourage others"],
    moderatorIds: ["user-5"],
    isJoined: false,
    isPrivate: false,
    createdAt: new Date()
  }
];

export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    type: "direct",
    participants: [mockUsers[2], mockUsers[0]], // Demo user and Alice
    lastMessage: "That sounds like a great idea! Let's do it.",
    lastMessageAt: new Date(Date.now() - 3600000),
    unreadCount: 0
  },
  {
    id: "conv-2",
    type: "direct",
    participants: [mockUsers[2], mockUsers[1]], // Demo user and Bob
    lastMessage: "Did you check out the new API update?",
    lastMessageAt: new Date(Date.now() - 3600000 * 5),
    unreadCount: 2
  },
  {
    id: "conv-3",
    type: "group",
    name: "Project Phoenix Team",
    participants: [mockUsers[2], mockUsers[0], mockUsers[4]],
    lastMessage: "Alice: I uploaded the new assets.",
    lastMessageAt: new Date(Date.now() - 3600000 * 24),
    unreadCount: 5
  }
];

export const mockMessages: Record<string, Message[]> = {
  "conv-1": [
    {
      id: "msg-1",
      senderId: "user-1",
      content: "Hey Jane! Are we still on for the design review tomorrow?",
      type: "text",
      reactions: {},
      readBy: ["demo-user"],
      createdAt: new Date(Date.now() - 3600000 * 2)
    },
    {
      id: "msg-2",
      senderId: "demo-user",
      content: "Yes! I've prepared the new mockups.",
      type: "text",
      reactions: { "👍": ["user-1"] },
      readBy: ["user-1"],
      createdAt: new Date(Date.now() - 3600000 * 1.5)
    },
    {
      id: "msg-3",
      senderId: "user-1",
      content: "That sounds like a great idea! Let's do it.",
      type: "text",
      reactions: {},
      readBy: ["demo-user"],
      createdAt: new Date(Date.now() - 3600000)
    }
  ]
};

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "daily_spark",
    actorId: "system",
    actor: { ...mockUsers[0], displayName: "System", avatarUrl: "" },
    message: "Today's spark is waiting for you: What are you grateful for today?",
    read: false,
    createdAt: new Date()
  },
  {
    id: "notif-2",
    type: "like",
    actorId: "user-1",
    actor: mockUsers[0],
    postId: "post-4",
    message: "Alice Wonderland liked your post",
    read: false,
    createdAt: new Date(Date.now() - 3600000)
  },
  {
    id: "notif-3",
    type: "comment",
    actorId: "user-4",
    actor: mockUsers[3],
    postId: "post-4",
    message: "Charlie Chaplin commented: \"Beautiful shot!\"",
    read: true,
    createdAt: new Date(Date.now() - 3600000 * 5)
  },
  {
    id: "notif-4",
    type: "follow",
    actorId: "user-5",
    actor: mockUsers[4],
    message: "Diana Prince started following you",
    read: true,
    createdAt: new Date(Date.now() - 3600000 * 24)
  }
];

export const dailySparks = [
  "What made you smile today?",
  "Share a song that's been stuck in your head.",
  "What's a small win you had this week?",
  "If you could travel anywhere right now, where would it be?",
  "What's your current favorite hobby?",
  "Share a photo that means a lot to you.",
  "What are you looking forward to this weekend?",
];
