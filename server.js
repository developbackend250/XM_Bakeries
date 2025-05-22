const express =require('express');
const mysql =require('mysql2');
const cors = require('cors');

require('dotenv').config();

const app= express();

//midleware section
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));


//connection to the database
const connection = mysql.createConnection({
    host: process.env.HOST_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    database: process.env.DB_NAME
})
connection.connect((error)=>{
    if(error){
        console.error('Error in connection',error);
        return;
        
    }else{
        console.log('Connection successfully');
        
    }
})
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inventory', require('./routes/inventory'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
