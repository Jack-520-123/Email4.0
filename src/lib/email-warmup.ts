import { prisma } from './prisma';
import nodemailer from 'nodemailer';
import { randomInt } from 'crypto';

// 全局变量类型声明
declare global {
  var warmupRotationState: Map<string, any> | undefined;
}

interface WarmupPair {
  from: {
    id: string;
    email: string;
    password: string;
    smtpServer: string;
    smtpPort: number;
  };
  to: {
    id: string;
    email: string;
  };
}

const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const DEFAULT_WARMUP_EMAILS: { subject: string; question: string; answer: string }[] = [
  {
      subject: 'Project Update',
      question: 'Hi, could you provide an update on the project status?',
      answer: 'Sure, we are on track with the timeline. I will send a detailed report by end of day.'
  },
  {
      subject: 'Quick Question',
      question: 'Do you have a minute to answer a quick question about the new feature?',
      answer: 'Yes, I am available now. Feel free to ask.'
  },
  // Business Communication
    {
        subject: 'Quarterly Review Meeting',
        question: 'When would be a good time to schedule our quarterly review meeting?',
        answer: 'I am available next Tuesday afternoon or Wednesday morning. Which time works better for you?'
    },
    {
        subject: 'Product Launch Timeline',
        question: 'Can we discuss the timeline for our upcoming product launch?',
        answer: 'I have prepared a detailed timeline. Let me know when you are free to go through it.'
    },
    // Customer Service
    {
        subject: 'Service Feedback',
        question: 'How was your experience with our customer service team?',
        answer: 'Thank you for asking. The service was excellent and very professional.'
    },
    {
        subject: 'Account Assistance',
        question: 'I need help accessing my account. Could you assist me?',
        answer: 'Of course! Please provide your account details and I will help you right away.'
    },
    // Technical Support
    {
        subject: 'System Update Information',
        question: 'When is the next system maintenance scheduled?',
        answer: 'The maintenance is planned for this Sunday at 2 AM. It should take about 2 hours.'
    },
    {
        subject: 'Bug Report Follow-up',
        question: 'Have you had a chance to look into the bug I reported?',
        answer: 'Yes, our team has identified the issue and we are working on a fix.'
    },
    // Event Planning
    {
        subject: 'Team Building Event',
        question: 'What activities would you prefer for our team building day?',
        answer: 'I think outdoor activities like hiking or a cooking class would be great for team bonding.'
    },
    {
        subject: 'Conference Registration',
        question: 'Is it too late to register for the upcoming conference?',
        answer: 'No, registration is still open until the end of this week.'
    },
    // Training and Development
    {
        subject: 'Workshop Feedback',
        question: 'What did you think about yesterday\'s workshop?',
        answer: 'It was very informative and practical. I learned several new techniques.'
    },
    {
        subject: 'Training Materials Request',
        question: 'Could you share the materials from last week\'s training session?',
        answer: 'I will send you the presentation slides and handouts right away.'
    },
    // Project Management
    {
        subject: 'Resource Allocation',
        question: 'Do we have enough resources for the new project phase?',
        answer: 'I have reviewed our capacity and we need to bring in two more developers.'
    },
    {
        subject: 'Milestone Update',
        question: 'Are we on track to meet the next milestone?',
        answer: 'Yes, all tasks are progressing well and we should meet the deadline.'
    },
    // Networking
    {
        subject: 'Industry Conference',
        question: 'Will you be attending the industry conference next month?',
        answer: 'Yes, I will be there. It would be great to meet up and discuss potential collaborations.'
    },
    {
        subject: 'Partnership Opportunity',
        question: 'I would like to explore potential partnership opportunities with your company.',
        answer: 'That sounds interesting. Let\'s schedule a call to discuss this further.'
    },
    // Human Resources
    {
        subject: 'Leave Request',
        question: 'I would like to take next week off. Is that possible?',
        answer: 'Your leave request has been approved. Enjoy your time off!'
    },
    {
        subject: 'Benefits Inquiry',
        question: 'Could you explain our new health insurance benefits?',
        answer: 'I will send you a detailed breakdown of the new benefits package.'
    },
    // Personal Life & Social
    {
        subject: 'Weekend Plans?',
        question: 'Any exciting plans for the weekend?',
        answer: 'Not yet, I was thinking of just relaxing at home. What about you?'
    },
    {
        subject: 'New Restaurant Recommendation',
        question: 'I found a new Italian place downtown, want to check it out sometime?',
        answer: 'Sounds great! I love Italian food. I am free on Friday evening.'
    },
    {
        subject: 'Book Club',
        question: 'Are you still interested in joining our book club?',
        answer: 'Yes, definitely! What is the book for this month?'
    },
    {
        subject: 'Movie Night',
        question: 'There is a new sci-fi movie out. Fancy watching it together?',
        answer: 'I am a big fan of sci-fi! Let’s go this weekend.'
    },

    // Hobbies & Interests
    {
        subject: 'Gardening Tips',
        question: 'My plants are not doing so well. Do you have any gardening tips?',
        answer: 'Sure, make sure they get enough sunlight and don’t overwater them. I can send you a helpful article.'
    },
    {
        subject: 'Photography Trip',
        question: 'I am planning a photography trip to the mountains. Would you like to join?',
        answer: 'That sounds amazing! I would love to join and capture some beautiful landscapes.'
    },
    {
        subject: 'Cooking Class',
        question: 'I signed up for a cooking class next month. Want to come along?',
        answer: 'That sounds fun! What kind of cuisine will you be learning?'
    },
    {
        subject: 'DIY Project',
        question: 'I am starting a new DIY project at home. Any ideas?',
        answer: 'How about building a small bookshelf? It is a practical and rewarding project.'
    },

    // Travel
    {
        subject: 'Vacation Ideas',
        question: 'I am planning my next vacation. Any recommendations?',
        answer: 'You should visit Southeast Asia. The culture and food are incredible.'
    },
    {
        subject: 'Travel Itinerary',
        question: 'Could you share your itinerary from your trip to Japan?',
        answer: 'Of course, I will send it to you. It has all the places I visited and some travel tips.'
    },
    {
        subject: 'Beach Getaway',
        question: 'I am thinking of a beach getaway. Any suggestions for a good spot?',
        answer: 'You should check out the beaches in Thailand. They are stunning.'
    },
    {
        subject: 'City Break',
        question: 'What is your favorite city for a short city break?',
        answer: 'I love Rome. The history, art, and food are just amazing.'
    },

    // Technology & Gadgets
    {
        subject: 'New Smartphone',
        question: 'Have you seen the latest smartphone from that brand?',
        answer: 'Yes, the camera looks impressive. I am thinking of upgrading.'
    },
    {
        subject: 'Software Update',
        question: 'Did you get the new software update for your laptop?',
        answer: 'Not yet. Are there any cool new features?'
    },
    {
        subject: 'Smart Home Devices',
        question: 'Are you using any smart home devices?',
        answer: 'Yes, I have smart lights and a smart thermostat. They are very convenient.'
    },
    {
        subject: 'Tech News',
        question: 'Did you read about the latest breakthrough in AI?',
        answer: 'Yes, it is fascinating how quickly the technology is evolving.'
    },
    // Health & Wellness
    {
        subject: 'Fitness Goals',
        question: 'I am trying to set some new fitness goals. Any advice?',
        answer: 'That is great! Starting with small, achievable goals is key. Maybe try a 30-minute walk every day.'
    },
    {
        subject: 'Healthy Recipes',
        question: 'Do you have any healthy and easy-to-make recipes?',
        answer: 'I have a great recipe for a quinoa salad. It is delicious and packed with nutrients. I will send it to you.'
    },

    // Finance & Investment
    {
        subject: 'Investment Tips',
        question: 'I am new to investing. Any tips for a beginner?',
        answer: 'It is wise to start with low-risk investments like index funds. Diversification is also very important.'
    },
    {
        subject: 'Saving Money',
        question: 'I am trying to save more money. What are your best saving tips?',
        answer: 'Creating a budget and tracking your expenses can make a big difference. Also, try to automate your savings.'
    },

    // Education & Learning
    {
        subject: 'Online Courses',
        question: 'Can you recommend any good platforms for online courses?',
        answer: 'Coursera and edX have a wide range of courses from top universities. It depends on what you want to learn.'
    },
    {
        subject: 'Learning a New Language',
        question: 'I want to learn a new language. Which one do you think is useful?',
        answer: 'Spanish and Mandarin are widely spoken and could be very beneficial for your career.'
    },

    // Career & Job Search
    {
        subject: 'Resume Feedback',
        question: 'Could you take a look at my resume and give me some feedback?',
        answer: 'Sure, I would be happy to. Send it over and I will get back to you with my suggestions.'
    },
    {
        subject: 'Job Interview Tips',
        question: 'I have a job interview next week. Any tips?',
        answer: 'Research the company thoroughly and prepare some questions to ask them. And be confident!'
    },

    // Real Estate
    {
        subject: 'House Hunting',
        question: 'We are looking for a new house. Any advice on the process?',
        answer: 'Make a list of your must-haves and nice-to-haves. And get pre-approved for a mortgage before you start looking.'
    },
    {
        subject: 'Home Renovation',
        question: 'We are planning to renovate our kitchen. Any ideas?',
        answer: 'Open-concept kitchens are very popular now. And consider adding a kitchen island for more counter space.'
    },

    // Volunteering & Community
    {
        subject: 'Volunteering Opportunities',
        question: 'I want to do some volunteer work. Do you know of any good organizations?',
        answer: 'The local animal shelter is always looking for volunteers. Or you could help out at the community garden.'
    },
    {
        subject: 'Community Event',
        question: 'Are you going to the community picnic this weekend?',
        answer: 'Yes, I will be there with my family. It is always a fun event.'
    },

    // Arts & Culture
    {
        subject: 'Museum Exhibition',
        question: 'Have you seen the new exhibition at the art museum?',
        answer: 'Not yet, but I have heard it is amazing. We should go together.'
    },
    {
        subject: 'Theater Show',
        question: 'I have an extra ticket for a theater show on Saturday. Are you interested?',
        answer: 'I would love to! What show is it?'
    },

    // Pets
    {
        subject: 'New Puppy',
        question: 'We are getting a new puppy! Any tips for a first-time dog owner?',
        answer: 'Congratulations! Patience and consistency are key for training. And lots of chew toys!'
    },
    {
        subject: 'Cat vs Dog',
        question: 'We are thinking of getting a pet. Should we get a cat or a dog?',
        answer: 'It depends on your lifestyle. Cats are more independent, while dogs require more attention and exercise.'
    },

    // Food & Cooking
    {
        subject: 'Baking Challenge',
        question: 'I am trying to bake a sourdough bread. It is quite challenging.',
        answer: 'I know, it takes practice. But the result is so worth it. Don’t give up!'
    },
    {
        subject: 'Favorite Cuisine',
        question: 'What is your favorite type of food?',
        answer: 'I love Thai food. The combination of sweet, sour, and spicy is just perfect.'
    },

    // Current Events
    {
        subject: 'Recent News',
        question: 'Did you hear about the latest news on climate change?',
        answer: 'Yes, it is quite concerning. We all need to do our part to protect the environment.'
    },
    {
        subject: 'Election Season',
        question: 'Are you following the current election season?',
        answer: 'Yes, it is important to stay informed and exercise our right to vote.'
    },
    // Sports & Fitness
    {
        subject: 'Basketball Game',
        question: 'Did you watch the basketball game last night? It was a nail-biter!',
        answer: 'Yes, I did! The last quarter was so intense. What a great game!'
    },
    {
        subject: 'Running a Marathon',
        question: 'I am thinking of running a marathon next year. Any training tips?',
        answer: 'That is a fantastic goal! Start with shorter runs and gradually increase your distance. Proper shoes are also crucial.'
    },

    // Music & Concerts
    {
        subject: 'New Album Release',
        question: 'Have you listened to the new album by that artist? It is amazing.',
        answer: 'I have had it on repeat all day! Every song is a masterpiece.'
    },
    {
        subject: 'Upcoming Concert',
        question: 'Are you going to the concert next month? I heard the tickets are selling out fast.',
        answer: 'I got my tickets last week! It is going to be an epic show.'
    },

    // Fashion & Style
    {
        subject: 'Latest Fashion Trends',
        question: 'What are the latest fashion trends for this season?',
        answer: 'It seems like bold colors and vintage styles are making a comeback. I saw some cool outfits online.'
    },
    {
        subject: 'Shopping Trip',
        question: 'I am going shopping for some new clothes this weekend. Want to join?',
        answer: 'I would love to! I need a new pair of jeans. Let me know when and where.'
    },

    // Home & Decor
    {
        subject: 'Home Office Setup',
        question: 'I am trying to improve my home office setup. Any suggestions?',
        answer: 'An ergonomic chair and a good monitor can make a huge difference. Also, try to get some plants for a better atmosphere.'
    },
    {
        subject: 'Interior Design Ideas',
        question: 'We are redecorating our living room. Any interior design ideas?',
        answer: 'Minimalist and Scandinavian designs are very popular and timeless. You can find a lot of inspiration on Pinterest.'
    },

    // Science & Nature
    {
        subject: 'Documentary Recommendation',
        question: 'Have you watched any good science documentaries lately?',
        answer: 'I recently watched one about the deep sea. It was mind-blowing. I highly recommend it.'
    },
    {
        subject: 'Stargazing',
        question: 'The sky is so clear tonight. Perfect for stargazing.',
        answer: 'Indeed. It is amazing to think about how vast the universe is.'
     },

    // Movies & TV Shows
    {
        subject: 'Movie Recommendation',
        question: 'I am looking for a good movie to watch this weekend. Any recommendations?',
        answer: 'If you like thrillers, you should watch the latest one from that director. It is full of twists.'
    },
    {
        subject: 'Binge-Watching a Series',
        question: 'I just started binge-watching that new TV series. I am hooked!',
        answer: 'I finished it last week! The ending was so unexpected. We should discuss it once you are done.'
    },

    // Books & Literature
    {
        subject: 'Currently Reading',
        question: 'What book are you currently reading?',
        answer: 'I am reading a historical fiction novel. The story is captivating, and the characters are well-developed.'
    },
    {
        subject: 'Book Club',
        question: 'Our book club is looking for a new book to read next month. Any suggestions?',
        answer: 'How about a classic? They often lead to great discussions.'
    },

    // Gaming
    {
        subject: 'New Game Release',
        question: 'Have you tried the new game that was released last week?',
        answer: 'Yes, I have been playing it non-stop! The graphics are stunning, and the gameplay is very engaging.'
    },
    {
        subject: 'Gaming Session',
        question: 'Are you free for a gaming session tonight?',
        answer: 'Sure, I am in! What time works for you?'
    },

    // Social Media
    {
        subject: 'Viral Trends',
        question: 'Have you seen the latest viral trend on social media?',
        answer: 'Yes, it is hilarious! I have already watched a dozen videos.'
    },
    {
        subject: 'Digital Detox',
        question: 'I am thinking of doing a digital detox for a week. Have you ever tried it?',
        answer: 'I did it once, and it was very refreshing. It helped me to be more present and focused.'
    },

    // DIY & Crafts
    {
        subject: 'DIY Project',
        question: 'I am starting a new DIY project this weekend. I am excited!',
        answer: 'That sounds fun! What are you making?'
    },
    {
        subject: 'Crafting Hobby',
        question: 'I am looking for a new crafting hobby. Any ideas?',
        answer: 'Knitting and pottery are very relaxing and rewarding. You should give them a try.'
    },

    // Personal Development
    {
        subject: 'Learning a New Skill',
        question: 'I am trying to learn a new skill this year. Any suggestions?',
        answer: 'Coding and public speaking are very valuable skills in today\'s world. There are many online resources to get you started.'
    },
    {
        subject: 'Time Management',
        question: 'I am struggling with time management. Do you have any tips?',
        answer: 'The Pomodoro Technique and time blocking have worked wonders for me. You should give them a try.'
    },

    // Finance & Investment
    {
        subject: 'Investing in Stocks',
        question: 'I am thinking about investing in stocks. Where should I start?',
        answer: 'It is a good idea to start with research and maybe consult a financial advisor. Diversifying your portfolio is also key.'
    },
    {
        subject: 'Saving Money',
        question: 'Do you have any effective tips for saving money?',
        answer: 'Creating a budget and tracking your expenses can make a big difference. Also, try to automate your savings.'
    },

    // Environment & Sustainability
    {
        subject: 'Reducing Plastic Waste',
        question: 'I am trying to reduce my plastic waste. Any practical tips?',
        answer: 'Using reusable bags, bottles, and containers is a great start. Also, try to buy products with minimal packaging.'
    },
    {
        subject: 'Sustainable Living',
        question: 'What are some simple ways to live more sustainably?',
        answer: 'Conserving water and energy, composting, and supporting local and sustainable businesses are all great steps.'
    },

    // Cultural Exchange
    {
        subject: 'Learning a New Language',
        question: 'I am learning a new language. Do you have any tips for practicing?',
        answer: 'Watching movies, listening to music, and finding a language exchange partner in that language can be very helpful.'
    },
    {
        subject: 'Traveling Abroad',
        question: 'I am planning a trip abroad. Any advice for immersing myself in the local culture?',
        answer: 'Try to learn some basic phrases in the local language, eat at local restaurants, and be open to new experiences.'
    },

    // Volunteering & Community
    {
        subject: 'Volunteering Opportunities',
        question: 'I want to start volunteering. How can I find opportunities in my community?',
        answer: 'You can check local community centers, non-profit organizations, and online platforms for volunteering opportunities.'
    },
    {
        subject: 'Community Garden',
        question: 'Our community is starting a garden. Would you like to join?',
        answer: 'That sounds wonderful! I would love to help out and grow some fresh vegetables.'
    },

    // Philosophy & Life
    {
        subject: 'Meaning of Life',
        question: 'Have you ever pondered the meaning of life?',
        answer: 'It is a profound question. I believe it is about finding purpose and happiness in our own way.'
    },
    {
        subject: 'Stoicism',
        question: 'I have been reading about Stoicism lately. It is quite fascinating.',
        answer: 'Indeed. The idea of focusing on what we can control is very powerful and practical.'
    },

    // History & Civilization
    {
        subject: 'Historical Event',
        question: 'If you could witness one historical event, what would it be?',
        answer: 'I would love to see the signing of the Declaration of Independence. It must have been a momentous occasion.'
    },
    {
        subject: 'Ancient Civilizations',
        question: 'Which ancient civilization do you find most interesting?',
        answer: 'The ancient Egyptians, with their pyramids and hieroglyphs, have always fascinated me.'
    },

    // Psychology & Mind
    {
        subject: 'Cognitive Biases',
        question: 'I have been learning about cognitive biases. It is amazing how they affect our thinking.',
        answer: 'It is true. Being aware of them can help us make more rational decisions.'
    },
    {
        subject: 'Mindfulness & Meditation',
        question: 'Have you tried mindfulness or meditation?',
        answer: 'Yes, it helps me to stay calm and focused, especially during stressful times.'
    },

    // Future & Technology
    {
        subject: 'Artificial Intelligence',
        question: 'What are your thoughts on the future of artificial intelligence?',
        answer: 'It has the potential to solve many of the world\'s problems, but we also need to consider the ethical implications.'
    },
    {
        subject: 'Space Exploration',
        question: 'Are you excited about the future of space exploration?',
        answer: 'Absolutely! The idea of humanity becoming a multi-planetary species is thrilling.'
    },

    // Art & Creativity
    {
        subject: 'Artistic Inspiration',
        question: 'Where do you find your artistic inspiration?',
        answer: 'Nature, music, and everyday life are my biggest sources of inspiration.'
    },
    {
        subject: 'Creative Process',
        question: 'What is your creative process like?',
        answer: 'It usually starts with a spark of an idea, followed by a lot of brainstorming and experimentation.'
    },

    // Entrepreneurship & Startups
    {
        subject: 'Business Idea',
        question: 'I have a business idea, but I am not sure where to start.',
        answer: 'That is exciting! A good first step is to do market research and create a solid business plan.'
    },
    {
        subject: 'Startup Culture',
        question: 'What do you think of the startup culture?',
        answer: 'It can be very dynamic and innovative, but it also comes with its own set of challenges, like long hours and uncertainty.'
    },

    // Non-profits & Social Impact
    {
        subject: 'Supporting a Cause',
        question: 'I want to support a cause I care about. How can I contribute?',
        answer: 'You can donate, volunteer your time, or use your skills to help a non-profit organization. Every little bit helps.'
    },
    {
        subject: 'Social Entrepreneurship',
        question: 'Have you heard of social entrepreneurship?',
        answer: 'Yes, it is a fascinating concept of using business principles to create positive social change.'
    },

    // Remote Work & Digital Nomadism
    {
        subject: 'Remote Work Productivity',
        question: 'How do you stay productive while working remotely?',
        answer: 'Having a dedicated workspace and a consistent routine is key. Also, it is important to take regular breaks.'
    },
    {
        subject: 'Digital Nomad Lifestyle',
        question: 'I am considering the digital nomad lifestyle. Any advice?',
        answer: 'It can be an amazing experience, but it requires a lot of planning and discipline. Make sure you have a reliable income source.'
    },

    // Mental Health & Well-being
    {
        subject: 'Dealing with Stress',
        question: 'How do you deal with stress in a healthy way?',
        answer: 'Exercise, meditation, and spending time in nature are my go-to stress relievers. Talking to someone also helps.'
    },
    {
        subject: 'Work-Life Balance',
        question: 'I am struggling to maintain a good work-life balance.',
        answer: 'It is a common struggle. Setting boundaries and prioritizing self-care are crucial for long-term well-being.'
    },

    // Ethical Technology
    {
        subject: 'Data Privacy',
        question: 'I am concerned about my data privacy online. What can I do?',
        answer: 'Using strong, unique passwords, enabling two-factor authentication, and being mindful of what you share are good practices.'
    },
    {
        subject: 'Ethical AI',
        question: 'What are your thoughts on the ethical implications of AI?',
        answer: 'It is a complex issue that requires careful consideration. We need to ensure that AI is developed and used responsibly and for the benefit of humanity.'
    },

    // Urbanism & City Life
    {
        subject: 'Public Transportation',
        question: 'What do you think of the public transportation in our city?',
        answer: 'It is quite efficient, but it could be improved with more frequent services during off-peak hours.'
    },
    {
        subject: 'City Parks',
        question: 'I love the parks in our city. They are great for relaxing and escaping the hustle and bustle.',
        answer: 'I agree. Having green spaces in a city is essential for the well-being of its residents.'
    },

    // Agriculture & Farming
    {
        subject: 'Organic Farming',
        question: 'I have been trying to buy more organic food lately.',
        answer: 'That is a great choice. Organic farming is better for the environment and our health.'
    },
    {
        subject: 'Urban Farming',
        question: 'Have you heard of urban farming?',
        answer: 'Yes, it is a great way to grow fresh food in cities and reduce food miles.'
    },

    // Journalism & Media
    {
        subject: 'Media Literacy',
        question: 'I think media literacy is a crucial skill in today\'s world.',
        answer: 'I could not agree more. It is important to be able to distinguish between credible sources and misinformation.'
    },
    {
        subject: 'The Future of Journalism',
        question: 'What do you think is the future of journalism?',
        answer: 'I think it will become more digital and interactive, but the core principles of accuracy and integrity will remain.'
    },

    // Law & Justice
    {
        subject: 'Jury Duty',
        question: 'I have been summoned for jury duty. Have you ever served on a jury?',
        answer: 'Yes, I have. It was a very interesting and educational experience.'
    },
    {
        subject: 'Civil Rights',
        question: 'I have been reading about the history of civil rights. It is very inspiring.',
        answer: 'It is a testament to the power of people to create positive change.'
    },

    // Education & Pedagogy
    {
        subject: 'Lifelong Learning',
        question: 'I believe in the importance of lifelong learning.',
        answer: 'Me too. There is always something new to learn, and it keeps our minds sharp.'
    },
    {
        subject: 'Alternative Education',
        question: 'What are your thoughts on alternative education models?',
        answer: 'I think they can be very effective for students who do not thrive in traditional school settings.'
    },

    // Healthcare & Wellness
    {
        subject: 'Preventive Healthcare',
        question: 'I am trying to focus more on preventive healthcare. Any suggestions?',
        answer: 'Regular exercise, a balanced diet, and adequate sleep are key. Also, do not forget regular check-ups.'
    },
    {
        subject: 'Mental Health Awareness',
        question: 'I think we need to talk more openly about mental health.',
        answer: 'Absolutely. Breaking the stigma around mental health is crucial for creating a supportive society.'
    },

    // Digital Art & Design
    {
        subject: 'Digital Art Tools',
        question: 'I want to start learning digital art. Which tools would you recommend?',
        answer: 'There are many great options. Some popular ones include Procreate for iPad and Adobe Photoshop for desktop.'
    },
    {
        subject: 'Design Trends',
        question: 'What are the current trends in digital design?',
        answer: 'Minimalism, dark mode interfaces, and 3D elements are quite popular right now.'
    },

    // Community Building
    {
        subject: 'Neighborhood Events',
        question: 'I am thinking of organizing a neighborhood event. Any ideas?',
        answer: 'A block party or community cleanup day could be great ways to bring people together.'
    },
    {
        subject: 'Local Business Support',
        question: 'How can we better support our local businesses?',
        answer: 'Shopping locally, leaving positive reviews, and recommending them to friends can make a big difference.'
    },

    // Career Development
    {
        subject: 'Career Change',
        question: 'I am considering a career change. How should I approach it?',
        answer: 'Research the new field, network with professionals, and consider taking relevant courses or certifications.'
    },
    {
        subject: 'Professional Growth',
        question: 'What are some effective ways to grow professionally?',
        answer: 'Continuous learning, seeking mentorship, and taking on challenging projects can help you develop new skills.'
    },

    // Lifestyle & Habits
    {
        subject: 'Morning Routine',
        question: 'I want to establish a better morning routine. Any tips?',
        answer: 'Start with small changes like waking up at the same time and having a healthy breakfast.'
    },
    {
        subject: 'Minimalist Living',
        question: 'I am interested in minimalist living. Where should I start?',
        answer: 'Begin by decluttering one area at a time and being mindful of new purchases.'
    },

    // Global Issues
    {
        subject: 'Climate Change',
        question: 'What are your thoughts on climate change?',
        answer: 'It is one of the most pressing issues of our time. We all have a role to play in creating a sustainable future.'
    },
    {
        subject: 'Global Poverty',
        question: 'How can we contribute to reducing global poverty?',
        answer: 'Supporting fair trade, donating to effective charities, and advocating for policy changes are all meaningful actions.'
    },

    // Cultural Heritage
    {
        subject: 'Preserving Heritage Sites',
        question: 'I think it is important to preserve our cultural heritage sites.',
        answer: 'I agree. They are a link to our past and a source of identity and inspiration for future generations.'
    },
    {
        subject: 'Traditional Crafts',
        question: 'I am fascinated by traditional crafts. It is amazing how these skills are passed down through generations.',
        answer: 'Me too. They are a beautiful expression of culture and creativity.'
    },

    // Scientific Discoveries
    {
        subject: 'Recent Breakthroughs',
        question: 'Have you read about any exciting scientific breakthroughs recently?',
        answer: 'Yes, I read about a new discovery in gene editing. It has the potential to revolutionize medicine.'
    },
    {
        subject: 'The Universe',
        question: 'The more we learn about the universe, the more mysterious it seems.',
        answer: 'I know, right? It is a humbling and awe-inspiring thought.'
    },

    // Personal Finance
    {
        subject: 'Retirement Planning',
        question: 'I am starting to think about retirement planning. Any advice?',
        answer: 'It is never too early to start. Contributing to a retirement account and investing wisely are key.'
    },
    {
        subject: 'Financial Literacy',
        question: 'I wish financial literacy was taught more in schools.',
        answer: 'I completely agree. It is an essential life skill that everyone should have.'
    },

    // Food & Culture
    {
        subject: 'Exploring Cuisines',
        question: 'I love exploring different cuisines. What is your favorite?',
        answer: 'I am a big fan of Italian food. The simplicity and quality of ingredients are what make it so special.'
    },
    {
        subject: 'Cooking as a Hobby',
        question: 'I find cooking to be a very relaxing and creative hobby.',
        answer: 'Me too. It is a great way to unwind and create something delicious.'
    },

    // Personal Growth
    {
        subject: 'Self-Reflection',
        question: 'I have been trying to practice more self-reflection lately.',
        answer: 'That is a great habit. It helps to understand ourselves better and grow as a person.'
    },
    {
        subject: 'Learning from Mistakes',
        question: 'I made a mistake at work, but I learned a valuable lesson from it.',
        answer: 'That is the best way to look at it. Mistakes are opportunities for growth.'
    },

    // Relationships
    {
        subject: 'Friendship',
        question: 'I am so grateful for my friends. They make my life so much better.',
        answer: 'I feel the same way. Good friends are truly a treasure.'
    },
    {
        subject: 'Family Time',
        question: 'I am looking forward to spending some quality time with my family this weekend.',
        answer: 'That sounds lovely. Family time is so important.'
    },

    // Daily Life
    {
        subject: 'Commuting',
        question: 'My commute to work is so long. I wish I could use that time more productively.',
        answer: 'Have you tried listening to podcasts or audiobooks? It can make the commute more enjoyable and educational.'
    },
    {
        subject: 'Weekend Plans',
        question: 'Do you have any exciting plans for the weekend?',
        answer: 'I am planning to go for a hike and then relax with a good book.'
    },

    // Hobbies
    {
        subject: 'Photography',
        question: 'I have been getting into photography lately. It is a great way to capture beautiful moments.',
        answer: 'That is a wonderful hobby. Do you have a favorite subject to photograph?'
    },
    {
        subject: 'Gardening',
        question: 'I started a small herb garden on my balcony. It is so rewarding to use fresh herbs in my cooking.',
        answer: 'That sounds amazing. There is nothing like the taste of homegrown herbs.'
    },

    // Technology in Life
    {
        subject: 'Smart Home Devices',
        question: 'I am thinking of getting some smart home devices. Are they worth it?',
        answer: 'They can be very convenient. I love being able to control my lights and thermostat with my voice.'
    },
    {
        subject: 'Social Media Impact',
        question: 'I have been thinking about the impact of social media on our lives.',
        answer: 'It is a double-edged sword. It can be a great tool for connection, but it is also important to use it mindfully.'
    },

    // Weather & Seasons
    {
        subject: 'Favorite Season',
        question: 'What is your favorite season?',
        answer: 'I love autumn. The colors are beautiful, and the weather is perfect for cozy sweaters.'
    },
    {
        subject: 'Rainy Days',
        question: 'I love the sound of rain. It is so calming.',
        answer: 'Me too. It is the perfect excuse to stay in with a good book and a cup of tea.'
    },

    // Transportation & Travel
    {
        subject: 'Road Trips',
        question: 'I am planning a road trip for my next vacation. Any tips?',
        answer: 'Make a great playlist, pack some snacks, and do not be afraid to take detours and explore.'
    },
    {
        subject: 'Public Art',
        question: 'I love discovering public art when I travel to new cities.',
        answer: 'Me too. It adds so much character and vibrancy to a place.'
    },

    // Health & Diet
    {
        subject: 'Healthy Recipes',
        question: 'I am looking for some new healthy recipes to try. Any recommendations?',
        answer: 'I have been making a lot of quinoa salads lately. They are delicious, nutritious, and easy to make.'
    },
    {
        subject: 'Staying Hydrated',
        question: 'I am trying to drink more water throughout the day.',
        answer: 'That is a great habit. I carry a reusable water bottle with me everywhere to remind myself to stay hydrated.'
    },

    // Learning & Work
    {
        subject: 'Online Courses',
        question: 'I have been taking an online course to learn a new skill. It is very convenient.',
        answer: 'That is a great way to learn. There are so many high-quality courses available online now.'
    },
    {
        subject: 'Teamwork',
        question: 'I enjoy working in a team. We can achieve so much more together.',
        answer: 'I agree. Collaboration and communication are key to a successful team.'
    },

    // Leisure & Entertainment
    {
        subject: 'Board Games',
        question: 'I love playing board games with friends. It is a great way to socialize and have fun.',
        answer: 'Me too. Do you have a favorite board game?'
    },
    {
        subject: 'Podcasts',
        question: 'I have been listening to a lot of podcasts lately. There are so many interesting ones out there.',
        answer: 'I am a big fan of podcasts too. They are perfect for learning something new while doing other things.'
    },

    // Holidays & Celebrations
    {
        subject: 'Holiday Traditions',
        question: 'What are some of your favorite holiday traditions?',
        answer: 'I love baking cookies with my family and watching classic holiday movies.'
    },
    {
        subject: 'Birthday Celebrations',
        question: 'How do you like to celebrate your birthday?',
        answer: 'I prefer a quiet celebration with close friends and family.'
    },

    // Pets & Animals
    {
        subject: 'Pet Adoption',
        question: 'I am thinking of adopting a pet. Any advice?',
        answer: 'That is wonderful! Make sure you are ready for the commitment and choose a pet that fits your lifestyle.'
    },
    {
        subject: 'Wildlife Conservation',
        question: 'I am passionate about wildlife conservation. It is so important to protect endangered species.',
        answer: 'I agree. We all have a responsibility to protect our planet\'s biodiversity.'
    },

    // Home & Living
    {
        subject: 'Cozy Home',
        question: 'I love making my home feel cozy and inviting.',
        answer: 'Me too. Soft blankets, warm lighting, and personal touches can make all the difference.'
    },
    {
        subject: 'Spring Cleaning',
        question: 'I am planning to do some spring cleaning this weekend. It feels so good to declutter.',
        answer: 'I know what you mean. A clean and organized space can do wonders for your state of mind.'
    },

    // Personal Reflection
    {
        subject: 'Gratitude Journal',
        question: 'I started keeping a gratitude journal. It helps me to focus on the positive things in my life.',
        answer: 'That is a beautiful practice. It is so important to appreciate the good things, no matter how small.'
    },
    {
        subject: 'Childhood Memories',
        question: 'I was just thinking about some of my favorite childhood memories.',
        answer: 'It is nice to look back on those times. They shape who we are today.'
    },

    // Dreams & Aspirations
    {
        subject: 'Bucket List',
        question: 'What is something on your bucket list?',
        answer: 'I have always wanted to see the Northern Lights.'
    },
    {
        subject: 'Future Goals',
        question: 'What are some of your goals for the future?',
        answer: 'I want to continue learning and growing, both personally and professionally.'
    },

    // Language & Linguistics
    {
        subject: 'The Beauty of Language',
        question: 'I find the evolution of language to be fascinating.',
        answer: 'Me too. It is amazing how languages adapt and change over time.'
    },
    {
        subject: 'Bilingualism',
        question: 'I admire people who are bilingual. It is like having two worlds in one mind.',
        answer: 'It is a wonderful skill to have. It opens up so many opportunities for connection and understanding.'
    },

    // Culture & Society
    {
        subject: 'Cultural Appropriation',
        question: 'I have been thinking about the difference between cultural appreciation and appropriation.',
        answer: 'It is an important distinction to make. It is all about respect and understanding.'
    },
    {
        subject: 'Social Justice',
        question: 'I believe we all have a role to play in creating a more just and equitable society.',
        answer: 'I could not agree more. It starts with education, empathy, and action.'
    },

    // Technology & Ethics
    {
        subject: 'The Future of Work',
        question: 'How do you think technology will shape the future of work?',
        answer: 'I think it will automate many tasks, but it will also create new jobs that require creativity and critical thinking.'
    },
    {
        subject: 'The Right to Be Forgotten',
        question: 'I have been reading about the right to be forgotten online. It is a complex issue.',
        answer: 'It is a delicate balance between freedom of information and the right to privacy.'
    },

    // Personal Growth & Well-being
    {
        subject: 'The Power of Vulnerability',
        question: 'I have been learning about the power of vulnerability. It is not a weakness, but a strength.',
        answer: 'I agree. It takes courage to be vulnerable, and it is essential for building deep and meaningful connections.'
    },
    {
        subject: 'The Importance of Play',
        question: 'I think we often forget the importance of play as adults.',
        answer: 'So true. Play is not just for kids. It is essential for our creativity, well-being, and relationships.'
    },

    // Nature & Environment
    {
        subject: 'The Healing Power of Nature',
        question: 'I find that spending time in nature is very healing.',
        answer: 'Me too. It is a great way to de-stress and reconnect with ourselves.'
    },
    {
        subject: 'The Circular Economy',
        question: 'I have been learning about the circular economy. It is a great model for a sustainable future.',
        answer: 'It is a much-needed shift from our current linear model of take, make, and dispose.'
    },

    // Philosophy & History
    {
        subject: 'The Meaning of Life',
        question: 'I often ponder the meaning of life. It is a question that has intrigued philosophers for centuries.',
        answer: 'I think the meaning of life is not something to be found, but something to be created.'
    },
    {
        subject: 'Learning from History',
        question: 'I believe it is important to learn from history to avoid repeating the same mistakes.',
        answer: 'I agree. History provides us with valuable lessons and insights into the human condition.'
    },

    // Art & Creativity
    {
        subject: 'The Power of Art',
        question: 'I find that art has the power to move and inspire me in ways that nothing else can.',
        answer: 'Me too. Art can communicate complex emotions and ideas that are difficult to put into words.'
    },
    {
        subject: 'The Creative Process',
        question: 'I am fascinated by the creative process. It is amazing how ideas can come to life.',
        answer: 'It is a mysterious and wonderful thing. It requires both inspiration and perspiration.'
    },

    // Music & Performing Arts
    {
        subject: 'The Universal Language of Music',
        question: 'I believe that music is a universal language that can connect people from all walks of life.',
        answer: 'I agree. Music has a way of transcending cultural and linguistic barriers.'
    },
    {
        subject: 'The Magic of Live Performance',
        question: 'There is something magical about seeing a live performance. The energy is contagious.',
        answer: 'I know what you mean. It is a shared experience that creates a sense of community.'
    },

    // Food & Culture
    {
        subject: 'Food as a Cultural Bridge',
        question: 'I love how food can be a bridge between different cultures.',
        answer: 'Me too. It is a delicious way to learn about and appreciate other traditions.'
    },
    {
        subject: 'The Slow Food Movement',
        question: 'I am a big supporter of the slow food movement. It is all about quality, tradition, and sustainability.',
        answer: 'I agree. It is a much-needed antidote to our fast-paced, fast-food culture.'
    },

    // Science & Discovery
    {
        subject: 'The Wonders of the Universe',
        question: 'I am constantly amazed by the wonders of the universe. There is so much we still do not know.',
        answer: 'It is humbling to think about our place in the cosmos. It puts things into perspective.'
    },
    {
        subject: 'The Importance of Scientific Literacy',
        question: 'I believe that scientific literacy is more important than ever in today\'s world.',
        answer: 'I agree. It is essential for making informed decisions about our health, our planet, and our future.'
    },

    // Education & Learning
    {
        subject: 'Lifelong Learning',
        question: 'I believe that we should never stop learning. There is always something new to discover.',
        answer: 'I could not agree more. Lifelong learning keeps our minds sharp and our lives interesting.'
    },
    {
        subject: 'The Future of Education',
        question: 'How do you think technology will change education in the future?',
        answer: 'I think it will make education more personalized, accessible, and engaging.'
    },

    // Community & Volunteering
    {
        subject: 'The Importance of Community',
        question: 'I think it is so important to have a sense of community.',
        answer: 'I agree. It gives us a sense of belonging and support.'
    },
    {
        subject: 'The Joy of Volunteering',
        question: 'I find that volunteering is a very rewarding experience.',
        answer: 'Me too. It is a great way to give back to the community and make a difference.'
    },

    // Personal Finance & Career
    {
        subject: 'Financial Literacy',
        question: 'I think financial literacy is a crucial life skill.',
        answer: 'I agree. It is essential for making smart financial decisions and achieving financial freedom.'
    },
    {
        subject: 'Career Change',
        question: 'I am thinking about making a career change. It is a big decision.',
        answer: 'It is never too late to pursue your passion. With careful planning, you can make a successful transition.'
    },

    // Mindfulness & Mental Health
    {
        subject: 'The Power of Mindfulness',
        question: 'I have been practicing mindfulness lately. It helps me to stay present and calm.',
        answer: 'That is wonderful. Mindfulness is a great tool for managing stress and improving well-being.'
    },
    {
        subject: 'The Importance of Mental Health',
        question: 'I think we need to talk more openly about mental health.',
        answer: 'I agree. It is just as important as physical health, and there should be no stigma around it.'
    },

    // Travel & Adventure
    {
        subject: 'The Benefits of Travel',
        question: 'I believe that travel is one of the best forms of education.',
        answer: 'I could not agree more. It broadens our horizons and exposes us to new cultures and perspectives.'
    },
    {
        subject: 'The Thrill of Adventure',
        question: 'I love the thrill of adventure. It makes me feel alive.',
        answer: 'Me too. There is nothing like stepping out of your comfort zone and trying something new.'
    },

    // Digital Divide & AI Ethics
    {
        subject: 'The Digital Divide',
        question: 'I am concerned about the digital divide and how it affects access to information and opportunities.',
        answer: 'It is a serious issue. We need to work towards digital equity to ensure that everyone can participate in the digital world.'
    },
    {
        subject: 'The Ethics of AI',
        question: 'I have been thinking about the ethical implications of artificial intelligence.',
        answer: 'It is a complex and important topic. We need to ensure that AI is developed and used in a responsible and ethical manner.'
    },

    // Future of Transportation & Sleep
    {
        subject: 'The Future of Transportation',
        question: 'I am excited about the future of transportation, with self-driving cars and high-speed trains.',
        answer: 'Me too. It has the potential to make our cities more efficient, sustainable, and livable.'
    },
    {
        subject: 'The Importance of Sleep',
        question: 'I have been prioritizing my sleep lately. It makes such a difference in my energy and mood.',
        answer: 'I agree. Sleep is essential for our physical and mental health, yet it is often overlooked.'
    },

    // Storytelling & Forgiveness
    {
        subject: 'The Art of Storytelling',
        question: 'I believe that storytelling is a powerful tool for connection and understanding.',
        answer: 'I could not agree more. Stories have the power to shape our perceptions and inspire us to action.'
    },
    {
        subject: 'The Power of Forgiveness',
        question: 'I have been learning about the power of forgiveness. It is a gift you give to yourself.',
        answer: 'It is not always easy, but it is essential for healing and moving on.'
    },

    // Government & Food
    {
        subject: 'The Role of Government',
        question: 'What do you think is the proper role of government in society?',
        answer: 'It is a question that has been debated for centuries. I think it is to protect our rights and provide for the common good.'
    },
    {
        subject: 'The Future of Food',
        question: 'I am fascinated by the future of food, with innovations like vertical farming and plant-based meat.',
        answer: 'Me too. It is exciting to think about how we can feed a growing population in a sustainable way.'
    },

    // Empathy & Imperfection
    {
        subject: 'The Importance of Empathy',
        question: 'I believe that empathy is one of the most important human qualities.',
        answer: 'I agree. It is the ability to understand and share the feelings of another, and it is essential for building a compassionate world.'
    },
    {
        subject: 'The Beauty of Imperfection',
        question: 'I have been learning to embrace the beauty of imperfection.',
        answer: 'It is a wonderful perspective to have. It is our imperfections that make us unique and human.'
    },

    // Urban Planning & Space Exploration
    {
        subject: 'The Future of Cities',
        question: 'I am interested in how we can design cities that are more sustainable, equitable, and resilient.',
        answer: 'It is a critical challenge for the 21st century. We need to rethink how we live, work, and move in urban areas.'
    },
    {
        subject: 'The New Age of Space Exploration',
        question: 'I am excited about the new age of space exploration, with private companies and new technologies.',
        answer: 'Me too. It is inspiring to think about the possibilities of what we might discover and achieve.'
    },

    // Biodiversity & Simple Living
    {
        subject: 'The Importance of Biodiversity',
        question: 'I believe that biodiversity is essential for the health of our planet and our own well-being.',
        answer: 'I agree. We need to protect the rich variety of life on Earth for future generations.'
    },
    {
        subject: 'The Art of Simple Living',
        question: 'I have been trying to simplify my life and focus on what truly matters.',
        answer: 'It is a refreshing change from the consumerist culture that surrounds us. Less is often more.'
    },

    // Civic Engagement & Data Privacy
    {
        subject: 'The Importance of Civic Engagement',
        question: 'I believe that it is our duty as citizens to be informed and engaged in the political process.',
        answer: 'I agree. A healthy democracy depends on the active participation of its citizens.'
    },
    {
        subject: 'The Right to Data Privacy',
        question: 'I am concerned about the amount of personal data that is being collected and used without our knowledge or consent.',
        answer: 'It is a major issue in the digital age. We need stronger regulations to protect our privacy.'
    },

    // Renewable Energy & Mental Resilience
    {
        subject: 'The Promise of Renewable Energy',
        question: 'I am hopeful about the transition to renewable energy sources like solar and wind.',
        answer: 'Me too. It is essential for combating climate change and creating a more sustainable future.'
    },
    {
        subject: 'The Power of Mental Resilience',
        question: 'I have been working on building my mental resilience to better cope with life\'s challenges.',
        answer: 'It is a valuable skill to have. It allows us to bounce back from adversity and grow stronger.'
    },

    // Globalization & Cultural Identity
    {
        subject: 'The Impact of Globalization',
        question: 'I have been thinking about the pros and cons of globalization.',
        answer: 'It is a complex phenomenon with both positive and negative consequences. It has connected the world in unprecedented ways, but it has also created new challenges.'
    },
    {
        subject: 'The Importance of Cultural Identity',
        question: 'I believe that it is important to celebrate and preserve our cultural identity in a globalized world.',
        answer: 'I agree. Our cultural heritage is a vital part of who we are, and it enriches the tapestry of human experience.'
    },

    // Gig Economy & Gene Editing
    {
        subject: 'The Gig Economy',
        question: 'I have been reading about the rise of the gig economy. It offers flexibility, but also precarity.',
        answer: 'It is a double-edged sword. We need to find ways to protect the rights and well-being of gig workers.'
    },
    {
        subject: 'The Ethics of Gene Editing',
        question: 'I am fascinated and also concerned by the power of gene editing technologies like CRISPR.',
        answer: 'It has the potential to cure genetic diseases, but it also raises profound ethical questions that we need to address as a society.'
    },

    // Critical Thinking & Collective Action
    {
        subject: 'The Importance of Critical Thinking',
        question: 'I believe that critical thinking is an essential skill for navigating the complexities of the modern world.',
        answer: 'I could not agree more. It allows us to evaluate information, identify biases, and make reasoned judgments.'
    },
    {
        subject: 'The Power of Collective Action',
        question: 'I am inspired by the power of collective action to bring about social change.',
        answer: 'It shows that when people come together for a common cause, they can achieve extraordinary things.'
    },

    // Journalism & Right to Repair
    {
        subject: 'The Future of Journalism',
        question: 'I am concerned about the future of journalism in an age of misinformation and declining trust.',
        answer: 'We need to support independent, high-quality journalism more than ever. It is essential for a healthy democracy.'
    },
    {
        subject: 'The Right to Repair',
        question: 'I believe that we should have the right to repair our own devices and products.',
        answer: 'I agree. It is a matter of ownership, sustainability, and consumer rights.'
    },

    // Intergenerational Connections & The Art of Listening
    {
        subject: 'The Importance of Intergenerational Connections',
        question: 'I think it is so important for different generations to connect and learn from each other.',
        answer: 'I agree. It enriches our lives and strengthens our communities.'
    },
    {
        subject: 'The Art of Listening',
        question: 'I have been practicing the art of listening. It is about more than just hearing words.',
        answer: 'It is about being present, empathetic, and open to understanding another person\'s perspective.'
    },

    // Aging & Happiness
    {
        subject: 'The Challenges of Aging',
        question: 'I have been thinking about the challenges of aging in our society.',
        answer: 'We need to create a more age-friendly world that values and supports older adults.'
    },
    {
        subject: 'The Pursuit of Happiness',
        question: 'I believe that the pursuit of happiness is a fundamental human right.',
        answer: 'It is a journey, not a destination. It is about finding meaning, purpose, and joy in our lives.'
    },

    // Universal Basic Income & Climate Change Adaptation
    {
        subject: 'Universal Basic Income',
        question: 'I have been reading about the concept of universal basic income (UBI). It is a fascinating idea.',
        answer: 'It could be a powerful tool for reducing poverty and inequality, but there are also many challenges to consider.'
    },
    {
        subject: 'Climate Change Adaptation',
        question: 'I think we need to focus more on adapting to the impacts of climate change that are already happening.',
        answer: 'I agree. Mitigation is crucial, but we also need to build resilience in our communities and ecosystems.'
    },

    // Curiosity & Failure
    {
        subject: 'The Importance of Curiosity',
        question: 'I believe that curiosity is the engine of learning and discovery.',
        answer: 'I could not agree more. It is what drives us to ask questions, explore new ideas, and challenge the status quo.'
    },
    {
        subject: 'The Value of Failure',
        question: 'I have been learning to see failure not as an endpoint, but as a stepping stone to success.',
        answer: 'It is a valuable mindset to have. Failure provides us with opportunities to learn, grow, and improve.'
    },

    // Digital Citizenship & AI Creativity
    {
        subject: 'Digital Citizenship',
        question: 'I believe that we all have a responsibility to be good digital citizens.',
        answer: 'I agree. It is about being respectful, responsible, and ethical in our online interactions.'
    },
    {
        subject: 'The Creativity of AI',
        question: 'I am amazed by the creative potential of artificial intelligence, from generating art to composing music.',
        answer: 'It is a fascinating new frontier. It challenges our traditional notions of creativity and authorship.'
    },

    // Urban Farming & The Art of Solitude
    {
        subject: 'The Rise of Urban Farming',
        question: 'I am excited about the rise of urban farming. It is a great way to bring fresh, local food to cities.',
        answer: 'Me too. It can also help to create green spaces, build community, and improve food security.'
    },
    {
        subject: 'The Art of Solitude',
        question: 'I have been learning to appreciate the art of solitude. It is not the same as loneliness.',
        answer: 'It is a time for reflection, creativity, and self-discovery. It is essential for our mental and emotional well-being.'
    },

    // Trust & Hope
    {
        subject: 'The Erosion of Trust',
        question: 'I am concerned about the erosion of trust in our institutions and in each other.',
        answer: 'It is a serious problem. Trust is the foundation of a healthy society, and we need to work to rebuild it.'
    },
    {
        subject: 'The Power of Hope',
        question: 'I believe that hope is a powerful force for change.',
        answer: 'It is what gives us the courage to face challenges, the resilience to overcome adversity, and the vision to create a better future.'
    }
];

export async function initializeWarmupEmails() {
  const existingEmails = await prisma.warmupEmail.count();
  if (existingEmails === 0) {
    const shuffledEmails = shuffleArray(DEFAULT_WARMUP_EMAILS);
    const emailsToCreate = shuffledEmails.map(email => ({
      subject: email.subject,
      body: `${email.question}\n\n${email.answer}`
    }));
    await prisma.warmupEmail.createMany({
      data: emailsToCreate
    });
  }
}

const usedEmailIndices = new Set<number>();

const getUniqueRandomEmailIndex = (max: number) => {
  if (usedEmailIndices.size >= max) {
    usedEmailIndices.clear(); // Reset if all emails have been used
  }

  let index;
  do {
    index = Math.floor(Math.random() * max);
  } while (usedEmailIndices.has(index));

  usedEmailIndices.add(index);
  return index;
};

// 全局轮询状态管理
if (!global.warmupRotationState) {
  global.warmupRotationState = new Map();
}

const warmupRotationState = global.warmupRotationState;

// 初始化或获取轮询状态
function getRotationState(campaignId: string, emailProfiles: any[]) {
  if (!warmupRotationState.has(campaignId)) {
    // 创建所有可能的发送对组合
    const pairs: Array<{fromIndex: number, toIndex: number}> = [];
    for (let i = 0; i < emailProfiles.length; i++) {
      for (let j = 0; j < emailProfiles.length; j++) {
        if (i !== j) {
          pairs.push({ fromIndex: i, toIndex: j });
        }
      }
    }
    
    // 打乱顺序以增加随机性
    const shuffledPairs = shuffleArray(pairs);
    
    warmupRotationState.set(campaignId, {
      pairs: shuffledPairs,
      currentIndex: 0,
      totalPairs: shuffledPairs.length
    });
    
    console.log(`[Warmup] 为活动 ${campaignId} 创建了 ${shuffledPairs.length} 个发送对`);
  }
  
  return warmupRotationState.get(campaignId);
}

// 获取下一个发送对
function getNextWarmupPair(campaignId: string, emailProfiles: any[]): WarmupPair | null {
  const state = getRotationState(campaignId, emailProfiles);
  
  if (state.currentIndex >= state.totalPairs) {
    // 一轮完成，重新开始
    state.currentIndex = 0;
    // 重新打乱顺序
    state.pairs = shuffleArray(state.pairs);
    console.log(`[Warmup] 活动 ${campaignId} 完成一轮互相发送，开始新一轮`);
  }
  
  const currentPair = state.pairs[state.currentIndex];
  state.currentIndex++;
  
  const fromProfile = emailProfiles[currentPair.fromIndex];
  const toProfile = emailProfiles[currentPair.toIndex];
  
  console.log(`[Warmup] 轮询发送 (${state.currentIndex}/${state.totalPairs}): ${fromProfile.email} -> ${toProfile.email}`);
  
  return {
    from: fromProfile,
    to: toProfile
  };
}

export async function processWarmupCampaign(campaignId: string) {
  try {
    const campaign = await prisma.warmupCampaign.findUnique({
      where: { id: campaignId },
      include: { emailProfiles: true }
    });

    if (!campaign || campaign.status !== 'active') {
      // 清理轮询状态
      warmupRotationState.delete(campaignId);
      return;
    }

    const emailProfiles = campaign.emailProfiles;
    if (emailProfiles.length < 2) {
      console.error(`[Warmup] 活动 ${campaignId} 邮箱数量不足，需要至少2个邮箱`);
      return;
    }

    // 获取下一个发送对（轮询方式）
    const warmupPair = getNextWarmupPair(campaignId, emailProfiles);
    if (!warmupPair) {
      console.error(`[Warmup] 无法获取发送对`);
      return;
    }

    // 随机选择一个预设邮件内容
    const warmupEmails = await prisma.warmupEmail.findMany();
    const emailIndex = getUniqueRandomEmailIndex(warmupEmails.length);
    const randomEmail = warmupEmails[emailIndex];

    // 发送预热邮件
    await sendWarmupEmail(campaign.id, warmupPair, randomEmail);

    // 设置下一次发送的时间
    const nextDelay = randomInt(campaign.minSendDelay * 60000, campaign.maxSendDelay * 60000);
    setTimeout(() => processWarmupCampaign(campaignId), nextDelay);

  } catch (error) {
    console.error('处理预热活动失败:', error);
    // 发生错误时清理轮询状态
    warmupRotationState.delete(campaignId);
  }
}

async function sendWarmupEmail(
  campaignId: string,
  pair: WarmupPair,
  content: { subject: string; body: string }
) {
  const transportOptions: any = {
    host: pair.from.smtpServer,
    port: pair.from.smtpPort,
    secure: pair.from.smtpPort === 465,
    auth: {
      user: pair.from.email,
      pass: pair.from.password
    }
  };
  const transporter = nodemailer.createTransport(transportOptions);

  try {
    await transporter.sendMail({
      from: pair.from.email,
      to: pair.to.email,
      subject: content.subject,
      text: content.body
    });

    // 记录发送日志
    await prisma.warmupLog.create({
      data: {
        warmupCampaignId: campaignId,
        fromEmail: pair.from.email,
        toEmail: pair.to.email,
        subject: content.subject,
        body: content.body,
        status: 'success'
      }
    });

  } catch (error) {
    // 记录错误日志
    await prisma.warmupLog.create({
      data: {
        warmupCampaignId: campaignId,
        fromEmail: pair.from.email,
        toEmail: pair.to.email,
        subject: content.subject,
        body: content.body,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      }
    });

    throw error;
  }
}