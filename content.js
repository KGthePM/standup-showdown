// content.js - Comedy content database
const comedyContent = {
    // Punchlines for Setup Battle round
    punchlines: [
        "...and that's when I realized I was at the wrong funeral.",
        "...but apparently 'trust fall' means something different at a bank.",
        "...turns out 'gluten-free' doesn't mean 'free gluten'.",
        "...and that's how I became banned from every Home Depot in the tri-state area.",
        "...which explains why my GPS now speaks only in disappointed sighs.",
        "...and the TSA agent said, 'Sir, that's not how you use a metal detector.'",
        "...but my therapist says I'm making progress.",
        "...and that's when my mother-in-law finally approved of me.",
        "...turns out 'Netflix and chill' has a very different meaning at the retirement home.",
        "...and the fortune cookie was right: I should have stayed in bed.",
        "...which is why I'm no longer allowed at parent-teacher conferences.",
        "...and that's how I learned that 'organic' doesn't always mean 'edible'.",
        "...but my dog still won't make eye contact with me.",
        "...and the police officer said, 'I've never seen anyone parallel park like that before.'",
        "...turns out my spirit animal is a confused sloth.",
        "...and that's when I realized autocorrect had been writing my love letters.",
        "...but apparently that's not what they meant by 'customer service'.",
        "...and now I know why they call it 'rush hour' traffic.",
        "...which explains the strange looks at the yoga class.",
        "...and the waiter asked if I wanted to speak to a manager... again.",
        "...but my horoscope said this would be a good day.",
        "...and that's how I became the neighborhood's unofficial wildlife control.",
        "...turns out 'farm to table' doesn't include my backyard compost.",
        "...and my Fitbit filed a formal complaint.",
        "...which is why I'm now banned from all karaoke bars in the city.",
        "...and the delivery guy said, 'This is why we have size limits.'",
        "...but my cat judges me more than usual now.",
        "...and that's when I learned that Wi-Fi passwords have feelings too.",
        "...turns out 'artisanal' is just fancy talk for 'overpriced'.",
        "...and the librarian whispered, 'This is a new level of quiet.'",
        "...but my smart home is now dumber than ever.",
        "...and that's how I discovered my true calling as a professional apologizer.",
        "...which explains why my dating profile now lists 'amateur disaster' as a hobby.",
        "...and the dentist said, 'I've never seen teeth express existential dread before.'",
        "...but my plants are still more successful than my social life.",
        "...and that's when I realized my life needed subtitles.",
        "...turns out 'mindfulness' doesn't apply to microwave cooking times.",
        "...and the barista started charging me a 'complexity fee'.",
        "...which is why my mirror and I are no longer on speaking terms.",
        "...and that's how I learned that gravity is not just a suggestion.",
        "...but my refrigerator light bulb still believes in me.",
        "...and the pizza delivery guy now knows me by my existential crisis orders.",
        "...turns out 'life hack' is just another word for 'creative failure'.",
        "...and that's when my houseplants started an intervention.",
        "...which explains why my sock drawer filed for independence.",
        "...and the weather app apologized for my life choices.",
        "...but my coffee maker still starts every morning with hope.",
        "...and that's how I became the unofficial mascot for Murphy's Law.",
        "...turns out 'adulting' is just childhood with taxes and back pain.",
        "...and the self-checkout machine said, 'Please try being human again.'"
    ],

    // Setups for Punchline Challenge round
    setups: [
        "I went to buy some camouflage pants the other day...",
        "My wife told me to stop singing 'Wonderwall'...",
        "I told my cat a joke about dogs...",
        "I tried to catch some fog earlier...",
        "My friend decided to name his dog 'Five Miles'...",
        "I bought the world's worst thesaurus yesterday...",
        "I used to hate facial hair...",
        "My therapist says I have a preoccupation with vengeance...",
        "I'm reading a book about anti-gravity...",
        "I told my wife she was drawing her eyebrows too high...",
        "I went to a seafood disco last week...",
        "My math teacher called me average...",
        "I tried to sue the airline for losing my luggage...",
        "My friend asked me to help him round up his 37 sheep...",
        "I bought a dog from a blacksmith...",
        "I'm terrified of speed bumps...",
        "My wife accused me of being immature...",
        "I went to the doctor with hearing problems...",
        "My friend said he didn't understand cloning...",
        "I tried to organize a hide and seek tournament...",
        "My wife is really mad at the fact that I have no sense of direction...",
        "I lost my job at the bank...",
        "My friend keeps saying 'cheer up man it could be worse, you could be stuck underground in a hole full of water'...",
        "I hate Russian dolls...",
        "My wife said I should do lunges to stay in shape...",
        "I went to the store to buy some batteries...",
        "My friend told me I was delusional...",
        "I tried to make a belt out of watches...",
        "My doctor told me I'm going deaf...",
        "I went to a restaurant that serves 'breakfast at any time'..."
    ],

    // Topics for Full Joke Creation round
    topics: [
        "Airport Security",
        "Smart Home Devices",
        "Online Dating",
        "Grocery Shopping",
        "Social Media",
        "Exercise Classes",
        "Coffee Shops",
        "Traffic Jams",
        "Video Calls",
        "Self-Checkout Machines",
        "Weather Apps",
        "Food Delivery",
        "Parking",
        "Public Transportation",
        "Technology Support",
        "Family Reunions",
        "Home Improvement",
        "Cooking Shows",
        "Pet Behavior",
        "Streaming Services",
        "Phone Autocorrect",
        "Assembly Instructions",
        "Health Trends",
        "Travel Delays",
        "Password Requirements"
    ]
};

// Helper function to get random content
function getRandomContent(type, count = 1) {
    const content = comedyContent[type];
    if (!content) return [];
    
    const shuffled = [...content].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Helper function to get unique content for each player
function getUniqueContentForPlayers(type, playerCount) {
    const content = comedyContent[type];
    if (!content || playerCount > content.length) {
        throw new Error(`Not enough ${type} for ${playerCount} players`);
    }
    
    const shuffled = [...content].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, playerCount);
}

module.exports = {
    comedyContent,
    getRandomContent,
    getUniqueContentForPlayers
};