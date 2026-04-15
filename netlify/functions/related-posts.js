// netlify/functions/related-posts.js
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { currentPost, allPosts } = JSON.parse(event.body);
        
        const candidates = allPosts.filter(p => 
            parseInt(p.id) !== parseInt(currentPost.id) && 
            p.status === 'published'
        );
        
        if (candidates.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ recommendations: [] }) };
        }
        
        let prompt = `Find the 3 most relevant articles for a reader who just finished reading:

CURRENT ARTICLE:
Title: "${currentPost.title}"
Category: ${currentPost.category}
Content: ${currentPost.content.substring(0, 500)}

RECOMMEND FROM THESE ARTICLES (choose only from these):
`;

        candidates.forEach((p, i) => {
            prompt += `${i+1}. "${p.title}" (${p.category})\n`;
        });

        prompt += `\nReturn ONLY the numbers of the 3 most relevant articles, separated by commas. Example: "2,5,1"`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 30
            })
        });

        const data = await response.json();
        
        if (data.error) {
            return { statusCode: 200, body: JSON.stringify({ recommendations: [] }) };
        }
        
        const result = data.choices[0].message.content;
        const indices = result.split(',').map(i => parseInt(i.trim()) - 1);
        const recommendations = indices
            .filter(i => !isNaN(i) && i >= 0 && i < candidates.length)
            .slice(0, 3)
            .map(i => candidates[i]);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recommendations })
        };
        
    } catch (error) {
        return { statusCode: 200, body: JSON.stringify({ recommendations: [] }) };
    }
};