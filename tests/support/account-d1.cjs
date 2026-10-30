'use strict';
const {DatabaseSync}=require('node:sqlite');
function database(schema){const db=new DatabaseSync(':memory:');db.exec(schema);return {raw:db,prepare(sql){const statement={values:[],bind(...values){this.values=values;return this},async first(){return db.prepare(sql).get(...this.values)||null},async all(){return {results:db.prepare(sql).all(...this.values)}},async run(){const result=db.prepare(sql).run(...this.values);return {success:true,meta:{changes:Number(result.changes)}}}};return statement;},async batch(statements){db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};}
module.exports={database};
