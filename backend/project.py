# Define the database with classroom characters
database = [
    {"name": "Govardhan", "human": True, "tall": True, "fair": False, "beginner_gym_freak": True,"pro_gamer": False, "funny": True},
    {"name": "Ronni", "human": True, "tall": True, "fair": True, "beginner_gym_freak": False, "funny": False},
    {"name": "Vats", "human": True, "tall": True, "fair": True,"beginner_gym_freak": True, "pro_gamer": True, "funny": True}, 
]

def take_chance(answer, property):
    ans = answer.lower() == "y"

    to_remove = [d for d in database if property in d and d[property] != ans]
    for i in to_remove:
        database.remove(i)

    if len(database) == 1:
        print("Your character is " + database[0]["name"])
        quit()

# Start the game
print("Welcome to MindMancer!")
ans = input("Is your character human (y/n)? ")
take_chance(ans, "human")

ans = input("Is your character tall (y/n)? ")
take_chance(ans, "tall")

if len(database) > 1:
    print("I couldn't determine your character. Please tell me which character you were thinking of:")
    new_character = input("Enter the character's name: ")
    print(f"Thank you! I've noted that you were thinking of {new_character}.")
