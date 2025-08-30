const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import cors

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your_jwt_secret'; 

app.use(bodyParser.json());
app.use(cors()); 
const users = [];
const recipes = []; 
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    if (users.find(user => user.email === email)) {
        return res.status(400).json({ msg: 'User already exists' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = { id: users.length + 1, name, email, password: hashedPassword, recipes: [] }; 
        users.push(newUser);

        const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    const user = users.find(user => user.email === email);
    if (!user) {
        return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

app.get('/api/protected', auth, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ msg: 'User not found' });
    }
    const { password, ...userData } = user;
    res.json({ msg: `Welcome ${user.name}!`, user: userData });
});


app.get('/api/recipes/me', auth, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user.recipes);
});

app.post('/api/recipes', auth, (req, res) => {
    const { title, ingredients, instructions, calories, isPublic } = req.body;
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const newRecipe = {
        id: recipes.length + 1,
        userId: user.id,
        title,
        ingredients,
        instructions,
        calories: parseInt(calories),
        isFavorite: false,
        isPublic: !!isPublic, 
        authorName: user.name, 
        createdAt: new Date()
    };
    recipes.push(newRecipe);
    user.recipes.push(newRecipe); 

    res.status(201).json(newRecipe);
});

app.put('/api/recipes/:id', auth, (req, res) => {
    const { id } = req.params;
    const { title, ingredients, instructions, calories, isFavorite, isPublic } = req.body;
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const recipeIndex = user.recipes.findIndex(r => r.id === parseInt(id));
    if (recipeIndex === -1) return res.status(404).json({ msg: 'Recipe not found or not owned by user' });

    user.recipes[recipeIndex] = {
        ...user.recipes[recipeIndex],
        title: title || user.recipes[recipeIndex].title,
        ingredients: ingredients || user.recipes[recipeIndex].ingredients,
        instructions: instructions || user.recipes[recipeIndex].instructions,
        calories: calories ? parseInt(calories) : user.recipes[recipeIndex].calories,
        isFavorite: typeof isFavorite === 'boolean' ? isFavorite : user.recipes[recipeIndex].isFavorite,
        isPublic: typeof isPublic === 'boolean' ? isPublic : user.recipes[recipeIndex].isPublic,
    };
    const globalRecipeIndex = recipes.findIndex(r => r.id === parseInt(id));
    if (globalRecipeIndex !== -1) {
        recipes[globalRecipeIndex] = { ...user.recipes[recipeIndex] };
    }

    res.json(user.recipes[recipeIndex]);
});

app.delete('/api/recipes/:id', auth, (req, res) => {
    const { id } = req.params;
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const initialRecipeCount = user.recipes.length;
    user.recipes = user.recipes.filter(r => r.id !== parseInt(id));

    if (user.recipes.length === initialRecipeCount) {
        return res.status(404).json({ msg: 'Recipe not found or not owned by user' });
    }

    recipes = recipes.filter(r => r.id !== parseInt(id));

    res.json({ msg: 'Recipe removed' });
});


app.get('/api/recipes/public', (req, res) => {
    const publicRecipes = recipes.filter(r => r.isPublic);
    res.json(publicRecipes);
});


app.listen(PORT, () => console.log(`Server started on port ${PORT}`));