import pygame
import pygame_menu
import pandas as pd
import os
import random
import datetime


# GENERAL TO DO LIST

# Functionality
# TODO: Adversary player with a simple AI also gathering treats, taking them off the board for you (penalize hanging out in the water for too long)
# TODO: Start menu with an "instructions" button and a "start" button to launch the game
# TODO: Game Over states if food or water <= 0 or countdown timer reaches 0
# TODO: Game over menu with an option to play again (reset everything and send you back to the start menu)
# TODO: When poop or pee maxes out, auto dump all the next time you enter a square that you can poop or pee in.

# Aesthetics
# TODO: Aesthetic coat of paint: Replace house, pavement, and fence colors with textures.
# TODO: Adjust status bars to display the actual underlying values, with mapping from values to pixel size determined by STATUS_BAR_SCALE. When complete, adjust status counter to reflect this change.

# Gameplay Settings
FOOD_RATE = 0.1  # Amount of food consumed during each frame spent moving
WATER_RATE = 0.1  # Amount of water consumed during each frame spent moving
TREAT_VALUE = 10  # Amount of food added by each treat eaten
WATER_VALUE = 10  # Amount of water added by each frame spent drinking
WATER_MAX = 1000  # Max amount of water that the player can have in their inventory at one time

POOP_RATE = 1  # Amount of poop removed during each frame spent pooping
PEE_RATE = 1  # Amount of pee removed during each frame spent peeing
POOP_COST = 1  # Base amount of affection removed for each frame spent pooping in an owner's block
PEE_COST = 1  # Base amount of affection removed for each frame spent peeing in an owner's block
POOP_MAX = 100  # Max amount of poop that can be released in each block
PEE_MAX = 100  # Max amount of pee that can be released in each block

CLEAN_RATE = 1  # Amount of dirt removed by each frame spent cleaning
CLEAN_COST = 1  # Amount of food consumed during each frame spent cleaning

TRICK_RATE = 1  # Amount of affection gained for each frame spent doing a trick in an owner's block
TRICK_COST = 1  # Amount of food consumed for each frame spent doing a trick

BOWL_LIKELIHOOD = 0.3  # Lower value = Bowls less likely p(bowl) = BOWL_LIKELIHOOD * p(treat)
BAG_LIKELIHOOD = 0.05  # Lower value = Food bags less likely (same math as above)
BOWL_MULTIPLIER = 2  # How many treats one bowl is equivalent to
BAG_MULTIPLIER = 4  # How many treats one bag is equivalent to
BOWL_THRESHOLD = 50  # Minimum affection necessary for an owner to distribute bowls on their owned blocks
BAG_THRESHOLD = 90  # Minimum affection necessary for an owner to distribute bags on their owned blocks

START_FOOD = 50  # Amount of food the player starts with
START_WATER = 50  # Amount of water the player starts with

HEAT_PAVEMENT = 0.05  # Amount of water consumed each frame spent on pavement
HEAT_GRASS = 0.01  # Amount of water consumed each frame spent on grass

# Max amount of time allowed to play (before game over)
TIME_MAX = datetime.datetime(
    year=1995,
    month=8,
    day=9,
    hour=0,
    minute=20,
    second=0
)

# Display Settings
STATUS_BAR_SCALE = 8  # Amount by which each inventory value multiplied to get width of corresponding status bar
FPS = 10  # Refresh rate

# Initialize pygame
pygame.init()
clock = pygame.time.Clock()

# Set window size
display_info = pygame.display.Info()
WINDOW_WIDTH = display_info.current_w
WINDOW_HEIGHT = display_info.current_h - 60

# Set number of rows and columns
NUM_ROW = 26
NUM_COLUMN = 48

# Set row and column size
ROW_HEIGHT = WINDOW_HEIGHT // NUM_ROW - 4
COLUMN_WIDTH = WINDOW_WIDTH // NUM_COLUMN

# Set status bar area size
STATUS_HEIGHT = WINDOW_HEIGHT - (26 * ROW_HEIGHT)
STATUS_WIDTH = WINDOW_WIDTH

# Create window
SCREEN = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT), pygame.RESIZABLE)
pygame.display.set_caption("Husky Simulator 2022")

# 2D list of grass colors (row = destruction level, column = dirt level)
GRASS_0_0 = pygame.Color(30, 68, 3)
GRASS_1_0 = pygame.Color(100, 133, 9)
GRASS_2_0 = pygame.Color(192, 201, 7)
GRASS_0_1 = pygame.Color(136, 113, 0)
GRASS_0_2 = pygame.Color(187, 126, 4)
GRASS_1_1 = pygame.Color(120, 123, 0)
GRASS_1_2 = pygame.Color(145, 132, 0)
GRASS_2_1 = pygame.Color(167, 155, 0)
GRASS_2_2 = pygame.Color(161, 120, 0)

GRASS_COLORS = [
    [GRASS_0_0, GRASS_0_1, GRASS_0_2],
    [GRASS_1_0, GRASS_1_1, GRASS_1_2],
    [GRASS_2_0, GRASS_2_1, GRASS_2_2]
]

# Define colors for house
HOUSE_CLAY = pygame.Color(184, 66, 33)
HOUSE_MARBLE = pygame.Color(241, 242, 227)

# Define colors for pavement
PAVEMENT = pygame.Color(128, 126, 120)

# Define colors for fencing
FENCE = pygame.Color(158, 93, 8)

# Define colors for water
WATER = pygame.Color(156, 211, 219)

# Define colors for status bars
POOP = pygame.Color(112, 88, 0)
PEE = pygame.Color(225, 225, 0)
FOOD = pygame.Color(255, 99, 71)
STATUS_BAR_COUNTER = pygame.Color(0, 0, 0)
STATUS_BAR_LABEL = pygame.Color(255, 255, 255)
AFFECTION_COUNTER = pygame.Color(0, 0, 0)

# Import player sprite images
player_images_left = []
for img in os.listdir('Player_Images/Move_Left'):
    new_image = pygame.image.load('./Player_Images/Move_Left/' + img).convert()
    new_image.set_colorkey((0, 0, 0))
    player_images_left.append(new_image)

player_images_right = []
for img in os.listdir('Player_Images/Move_Right'):
    new_image = pygame.image.load('./Player_Images/Move_Right/' + img).convert()
    new_image.set_colorkey((0, 0, 0))
    player_images_right.append(new_image)

player_images_down = []
for img in os.listdir('Player_Images/Move_Down'):
    new_image = pygame.image.load('./Player_Images/Move_Down/' + img).convert()
    new_image.set_colorkey((0, 0, 0))
    player_images_down.append(new_image)

player_images_up = []
for img in os.listdir('Player_Images/Move_Up'):
    new_image = pygame.image.load('./Player_Images/Move_Up/' + img).convert()
    new_image.set_colorkey((0, 0, 0))
    player_images_up.append(new_image)

player_images_actions = []
for img in os.listdir('Player_Images/Stationary_Actions'):
    new_image = pygame.image.load('./Player_Images/Stationary_Actions/' + img).convert()
    new_image.set_colorkey((0, 0, 0))
    player_images_actions.append(new_image)

# Image order:
# 0: Lie Down Left
# 1: Lie Down Right
# 2: Peeing
# 3: Pooping 1
# 4: Pooping 2
# 5: Standing Blink Left
# 6: Standing Blink Right
# 7: Standing Down
# 8-10: Walk Down
# 11-13: Walk Left
# 14-16: Walk Right
# 17-19: Walk Up

# Import food object images
food_images = []
for img in os.listdir('Food_Images'):
    new_image = pygame.image.load('./Food_Images/' + img).convert()
    new_image.set_colorkey((0, 0, 0))
    food_images.append(new_image)


# Class for fence blocks
# TODO: Adjust to work with 16 x 16 fence images (in aesthetics phase)
# Use a thin rectangle for collisions and the fence picture for rendering
class BlockFence:
    def __init__(self, x, y, horizontal):
        self.x = x
        self.y = y
        self.horizontal = horizontal  # Logical; True if horizontal, else False
        self.width = 3  # Line width

        # If horizontal, make horizontal Rect. Else, make vertical Rect.
        if self.horizontal:
            self.rect = pygame.Rect(x, y, COLUMN_WIDTH, self.width)
        else:
            self.rect = pygame.Rect(x, y, self.width, ROW_HEIGHT)


# Class for grass blocks
class BlockGrass:
    def __init__(self, x, y, owner_id, block_id, fence_top=False, fence_bottom=False, fence_left=False,
                 fence_right=False):
        self.rect = pygame.Rect(x, y, COLUMN_WIDTH, ROW_HEIGHT)
        self.owner_id = owner_id
        self.block_id = block_id
        self.block_type = 'grass'

        self.destruction = 0
        self.dirt = 0
        self.food_present = False
        self.heat = HEAT_GRASS
        self.fences_exist = {
            'top': fence_top,
            'bottom': fence_bottom,
            'left': fence_left,
            'right': fence_right
        }

    # Method to draw the grass block. first_draw true if first time drawing a block, false otherwise
    def draw(self, first_draw=False):
        # Get color corresponding to current destruction and dirt values
        if self.destruction == 0:
            if self.dirt == 0:
                current_color = GRASS_COLORS[0][0]
            elif 0 < self.dirt < 50:
                current_color = GRASS_COLORS[0][1]
            elif self.dirt >= 50:
                current_color = GRASS_COLORS[0][2]
        elif 0 < self.destruction < 50:
            if self.dirt == 0:
                current_color = GRASS_COLORS[1][0]
            elif 0 < self.dirt < 50:
                current_color = GRASS_COLORS[1][1]
            elif self.dirt >= 50:
                current_color = GRASS_COLORS[1][2]
        elif self.destruction >= 50:
            if self.dirt == 0:
                current_color = GRASS_COLORS[2][0]
            elif 0 < self.dirt < 50:
                current_color = GRASS_COLORS[2][1]
            elif self.dirt >= 50:
                current_color = GRASS_COLORS[2][2]
        else:
            current_color = GRASS_COLORS[0][0]

        # Render grass block
        pygame.draw.rect(SCREEN, current_color, self.rect)

        # If there's a fence on a given side of the block, create, and draw
        if self.fences_exist.get('top'):
            new_fence = BlockFence(x=self.rect.topleft[0], y=self.rect.topleft[1], horizontal=True)
            pygame.draw.rect(SCREEN, FENCE, new_fence)

            # If drawing the block for the first time, append fence to collider_list
            if first_draw:
                collider_list.append(new_fence.rect)
        if self.fences_exist.get('bottom'):
            new_fence = BlockFence(x=self.rect.bottomleft[0], y=self.rect.bottomleft[1] - 3, horizontal=True)
            pygame.draw.rect(SCREEN, FENCE, new_fence)

            # If drawing the block for the first time, append fence to collider_list
            if first_draw:
                collider_list.append(new_fence.rect)
        if self.fences_exist.get('left'):
            new_fence = BlockFence(x=self.rect.topleft[0], y=self.rect.topleft[1], horizontal=False)
            pygame.draw.rect(SCREEN, FENCE, new_fence)

            # If drawing the block for the first time, append fence to collider_list
            if first_draw:
                collider_list.append(new_fence.rect)
        if self.fences_exist.get('right'):
            new_fence = BlockFence(x=self.rect.topright[0] - 3, y=self.rect.topright[1], horizontal=False)
            pygame.draw.rect(SCREEN, FENCE, new_fence)

            # If drawing the block for the first time, append fence to collider_list
            if first_draw:
                collider_list.append(new_fence.rect)

    # Function to produce a food object at the block's location with a given probability.
    def dispense_food(self, probability):
        rand_val = random.random()
        # If meet lowest probability threshold, and owner's affection is above threshold for bags...
        # create a bag of food at current block and append to appropriate lists
        if rand_val <= BAG_LIKELIHOOD * probability and owners_list[self.owner_id].affection > BAG_THRESHOLD:
            new_bag = Food('bag', self.rect.centerx, self.rect.centery)
            food_list.append(new_bag)
            food_rects_list.append(new_bag.rect)
            self.food_present = True

        # Elif meet second lowest probability threshold, and owner's affection is above threshold for bowls...
        # make a bowl of food at current block and append to appropriate lists
        elif rand_val <= BOWL_LIKELIHOOD * probability and owners_list[self.owner_id].affection > BOWL_THRESHOLD:
            new_bowl = Food('bowl', self.rect.centerx, self.rect.centery)
            food_list.append(new_bowl)
            food_rects_list.append(new_bowl.rect)
            self.food_present = True

        # Elif meet third lowest probability threshold, make a treat
        elif rand_val <= probability:
            new_treat = Food('treat', self.rect.centerx, self.rect.centery)
            food_list.append(new_treat)
            food_rects_list.append(new_treat.rect)
            self.food_present = True

    # Function to accept poop from the player dog
    def accept_poop(self):
        self.dirt += POOP_RATE

    # Function to accept pee from the player dog
    def accept_pee(self):
        self.destruction += PEE_RATE


# Class for pavement blocks
class BlockPavement:
    def __init__(self, x, y, owner_id, block_id):
        self.rect = pygame.Rect(x, y, COLUMN_WIDTH, ROW_HEIGHT)
        self.owner_id = owner_id
        self.block_id = block_id
        self.block_type = 'pavement'

        self.heat = HEAT_PAVEMENT
        self.food_present = False

    def draw(self):
        pygame.draw.rect(SCREEN, PAVEMENT, self.rect)


# Class for house blocks
class BlockHouse:
    def __init__(self, x, y, block_id, color):
        self.rect = pygame.Rect(x, y, COLUMN_WIDTH, ROW_HEIGHT)
        self.block_id = block_id
        self.block_type = 'house'

        self.heat = 0
        self.dirt = 0
        self.destruction = 0
        self.color = color
        collider_list.append(self.rect)  # Append new house block to list of collider objects

    def draw(self):
        if self.color == 'marble':
            pygame.draw.rect(SCREEN, HOUSE_MARBLE, self.rect)
        elif self.color == 'clay':
            pygame.draw.rect(SCREEN, HOUSE_CLAY, self.rect)


# Class for water blocks
class BlockWater:
    def __init__(self, x, y, owner_id, block_id):
        self.rect = pygame.Rect(x, y, COLUMN_WIDTH, ROW_HEIGHT)
        self.owner_id = owner_id
        self.block_id = block_id
        self.block_type = 'water'

        self.heat = 0
        self.food_present = False

    def draw(self):
        pygame.draw.rect(SCREEN, WATER, self.rect)


# Class for owner
class Owner:
    def __init__(self, owner_id, affection, sensitivity, treat_rate_base):
        self.owner_id = owner_id
        self.affection = affection
        self.sensitivity = sensitivity
        self.treat_rate_base = treat_rate_base
        # Active treat rate = prob(treat) in each owned block each frame
        self.treat_rate_active = self.treat_rate_base * (self.affection / 25)  # min affection mult. = 0, max = 4

    # Function to update owner's affection level based on current player behavior
    def update(self, player_action):
        if player_action == 'pee':
            if self.affection - (PEE_COST * self.sensitivity) > 0:
                self.affection -= (PEE_COST * self.sensitivity)
            else:
                self.affection = 0
        if player_action == 'poop':
            if self.affection - (POOP_COST * self.sensitivity) > 0:
                self.affection -= (POOP_COST * self.sensitivity)
            else:
                self.affection = 0
        if player_action == 'trick':
            if self.affection + TRICK_RATE < 100:
                self.affection += TRICK_RATE
            else:
                self.affection = 100


# Class for player
class Player(pygame.sprite.Sprite):
    def __init__(self):
        # Call parent class initialization function
        super().__init__()

        # Define inventory values
        self.food = START_FOOD
        self.water = START_WATER
        self.poop = 0
        self.pee = 0
        self.dirt = 0

        # Define misc object properties
        self.x = (COLUMN_WIDTH * 22) + (0.5 * COLUMN_WIDTH)
        self.y = (ROW_HEIGHT * 13) + (0.5 * ROW_HEIGHT)
        self.speed_x = 0
        self.speed_y = 0

        # Properties for tracking animations
        self.animation_counter = 0

        # Assign starting image
        self.image = player_images_left[1]

        # Get rectangle with same dimensions as the object
        self.rect = self.image.get_rect()
        # Set object location
        self.rect.center = (self.x, self.y)

        # Define 20 x 20 collision detection rects on all 4 sides of player
        self.coll_rect_top = pygame.Rect(
            (self.rect.midtop[0] - 10,
             self.rect.midtop[1] - 20,
             20,
             20)
        )
        self.coll_rect_bottom = pygame.Rect(
            (self.rect.midbottom[0] - 10,
             self.rect.midbottom[1],
             20,
             20)
        )
        self.coll_rect_right = pygame.Rect(
            (self.rect.midright[0],
             self.rect.midright[1] - 10,
             20,
             20)
        )
        self.coll_rect_left = pygame.Rect(
            (self.rect.midleft[0] - 20,
             self.rect.midleft[1] - 10,
             20,
             20)
        )

    # Function to set movement speed (amount to move per frame) based on the current movement direction
    def start_move(self, direction):
        # If moving to the left, decrease x coordinate every frame
        if direction == 'left':
            self.speed_x = -COLUMN_WIDTH

        # If moving to the right, increase x coordinate every frame
        if direction == 'right':
            self.speed_x = COLUMN_WIDTH

        # If moving down, increase y coordinate every frame
        if direction == 'down':
            self.speed_y = ROW_HEIGHT

        # If moving up, decrease y coordinate every frame
        if direction == 'up':
            self.speed_y = -ROW_HEIGHT

    # Function to set both movement speeds back to 0 and reset counters
    def stop_move(self, axis):
        if axis == 'x':
            self.speed_x = 0
        if axis == 'y':
            self.speed_y = 0

    # Function for updating resources after moving into a new square
    def consume_resources(self):
        # Consume food resources
        self.food -= FOOD_RATE
        self.poop += FOOD_RATE

        # Consume water resources
        self.water -= WATER_RATE
        self.pee += WATER_RATE

    # Function to reduce water inventory each turn based on the provided heat value of the current block
    def take_heat(self, heat):
        self.water -= heat
        self.pee += heat

    # Function for pooping
    def release_poop(self):
        if (self.poop - POOP_RATE) > 0:
            self.poop -= POOP_RATE
        else:
            self.poop = 0
        # TODO Add pooping image

    # Function for peeing
    def release_pee(self):
        if (self.pee - PEE_RATE) > 0:
            self.pee -= PEE_RATE
        else:
            self.pee = 0
        # TODO Add peeing image

    # Function for drinking at water blocks
    def drink(self):
        # If player is colliding with a water block and has free inventory space, increment their water inventory
        if self.rect.collidelist(water_rects_list) != -1:
            if (self.water * STATUS_BAR_SCALE) + (WATER_VALUE * STATUS_BAR_SCALE) < WATER_MAX:
                self.water += WATER_VALUE
            else:
                self.water = WATER_MAX / STATUS_BAR_SCALE
            # TODO: Add drinking image

    # Function for doing tricks
    def do_trick(self):
        self.food -= TRICK_COST
        self.water -= TRICK_COST
        # TODO: Add tricking image

    # Function to change player position and image
    def animate_player(self, image_list):
        # If past the end of the image list, reset the counter to 0
        if self.animation_counter == len(image_list):
            self.animation_counter = 0

        # Move player
        self.rect.center = (self.rect.center[0] + self.speed_x, self.rect.center[1] + self.speed_y)
        # Update image
        self.image = image_list[self.animation_counter]
        # Increment counter
        self.animation_counter += 1

        # Move collision detection rects
        self.coll_rect_left.center = (
            self.coll_rect_left.center[0] + self.speed_x, self.coll_rect_left.center[1] + self.speed_y)
        self.coll_rect_right.center = (
            self.coll_rect_right.center[0] + self.speed_x, self.coll_rect_right.center[1] + self.speed_y)
        self.coll_rect_top.center = (
            self.coll_rect_top.center[0] + self.speed_x, self.coll_rect_top.center[1] + self.speed_y)
        self.coll_rect_bottom.center = (
            self.coll_rect_bottom.center[0] + self.speed_x, self.coll_rect_bottom.center[1] + self.speed_y)

    # Update image and player position
    def update(self):
        # If moving left, and no collider in player's path, cycle through left movement images
        if self.speed_x < 0 and self.coll_rect_left.centerx > 0:
            if self.coll_rect_left.collidelist(collider_list) == -1:
                self.animate_player(player_images_left)
                self.consume_resources()

        # If moving right, and no collider in player's path, cycle through right movement images
        if self.speed_x > 0 and self.coll_rect_right.centerx < WINDOW_WIDTH:
            if self.coll_rect_right.collidelist(collider_list) == -1:
                self.animate_player(player_images_right)
                self.consume_resources()

        # If moving down, and no collider in player's path, cycle through down movement images
        if self.speed_y > 0 and self.coll_rect_bottom.centery < 26 * ROW_HEIGHT:
            if self.coll_rect_bottom.collidelist(collider_list) == -1:
                self.animate_player(player_images_down)
                self.consume_resources()

        # If moving up, and no collider in player's path, cycle through up movement images
        if self.speed_y < 0 and self.coll_rect_top.centery > 0:
            if self.coll_rect_top.collidelist(collider_list) == -1:
                self.animate_player(player_images_up)
                self.consume_resources()


# Class for food objects
class Food:
    def __init__(self, food_type, x, y):
        if food_type == 'treat':
            self.food_value = TREAT_VALUE
            self.image = food_images[2]
            self.rect = self.image.get_rect()
            self.rect.center = (x, y)

        if food_type == 'bowl':
            self.food_value = BOWL_MULTIPLIER * TREAT_VALUE
            self.image = food_images[1]
            self.rect = self.image.get_rect()
            self.rect.center = (x, y)

        if food_type == 'bag':
            self.food_value = BAG_MULTIPLIER * TREAT_VALUE
            self.image = food_images[0]
            self.rect = self.image.get_rect()
            self.rect.center = (x, y)

    def draw(self):
        SCREEN.blit(self.image, self.rect.topleft)


# Class for status bar
# TODO: Add icons next to each status bar to reflect what the commodity is
class StatusBar:
    def __init__(self, name, rect_coords, color):
        # Set basic attributes
        self.name = name
        self.rect = pygame.Rect(rect_coords)
        self.max_width = (WINDOW_WIDTH / 2) - (4 * COLUMN_WIDTH)
        self.color = color

        # Create text label
        self.font = pygame.font.SysFont('Arial', 16)
        self.label_img = self.font.render(name, True, STATUS_BAR_LABEL)
        self.label_rect = self.label_img.get_rect()

        # Position text label
        self.label_rect.topleft = (self.rect.topleft[0], self.rect.topleft[1] + 20)

        # Create background rect for the status bar
        self.rect_background = pygame.Rect(
            (self.rect.topleft[0], self.rect.topleft[1], self.max_width, self.rect.height))

        # Create counter label
        self.counter_img = self.font.render(str(self.rect.width), True, STATUS_BAR_COUNTER)
        self.counter_rect = self.counter_img.get_rect()

        # Position counter label
        self.counter_rect.top = self.rect_background.top
        self.counter_rect.left = self.rect_background.left + 10

    # Function to update the status bar's width
    def update(self, new_width):
        # If new width value > max width, make status bar max width and display the correct numerical value
        if new_width >= self.max_width:
            self.rect.width = self.max_width
            self.counter_img = self.font.render(str(int(new_width)), True, STATUS_BAR_COUNTER)
        # Else (new width value < max width), update as usual
        else:
            # Change bar width to new width
            self.rect.width = new_width
            # Change counter label value
            self.counter_img = self.font.render(str(int(new_width)), True, STATUS_BAR_COUNTER)

    # Function to draw the status bar to the screen
    def draw(self):
        # Draw status bar background
        pygame.draw.rect(SCREEN, HOUSE_MARBLE, self.rect_background)

        # Draw status bar, label, and counter
        pygame.draw.rect(SCREEN, self.color, self.rect)
        SCREEN.blit(self.label_img, self.label_rect.topleft)
        SCREEN.blit(self.counter_img, self.counter_rect.topleft)


# Class for affection counter
class AffectionCounter:
    def __init__(self, owner_id, value, x, y):
        self.owner_id = owner_id
        self.value = value
        self.x = x
        self.y = y

        self.font = pygame.font.SysFont('Arial', 16)
        self.image = self.font.render(str(self.value), True, AFFECTION_COUNTER)
        self.rect = self.image.get_rect()
        self.rect.center = (self.x, self.y)

    # Update affection counter to display a new value
    def update(self, new_value):
        self.value = new_value
        self.image = self.font.render(str(self.value), True, AFFECTION_COUNTER)
        self.rect = self.image.get_rect()
        self.rect.center = (self.x, self.y)

    # Draw affection counter to the screen
    def draw(self):
        SCREEN.blit(self.image, self.rect.topleft)


# Class for block status indicator
class BlockStatusCounter:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.font_title = pygame.font.SysFont('Arial', 16, bold=True)
        self.font_body = pygame.font.SysFont('Arial', 16)

        self.title_img = self.font_title.render('Current Space:', True, HOUSE_MARBLE)
        self.title_rect = self.title_img.get_rect()
        self.title_rect.topleft = (self.x, self.y)

        self.heat_value = None
        self.dirt_value = None
        self.destruction_value = None

    # Function to update the block status counter to reflect values for a given block
    def update(self, block_object):
        if block_object.block_type == 'water':
            self.heat_value = 0
            self.dirt_value = 0
            self.destruction_value = 0
        elif block_object.block_type == 'pavement':
            self.heat_value = block_object.heat
            self.dirt_value = 0
            self.destruction_value = 0
        else:  # block_type == 'grass'
            self.heat_value = block_object.heat
            self.dirt_value = block_object.dirt * STATUS_BAR_SCALE
            self.destruction_value = block_object.destruction * STATUS_BAR_SCALE

    # Function to draw the block status counter
    def draw(self):
        row_1_img = self.font_body.render('Heat: ' + str(self.heat_value), True, HOUSE_MARBLE)
        row_2_img = self.font_body.render('Poop: ' + str(self.dirt_value), True, HOUSE_MARBLE)
        row_3_img = self.font_body.render('Pee: ' + str(self.destruction_value), True, HOUSE_MARBLE)

        SCREEN.blit(self.title_img, self.title_rect.topleft)
        SCREEN.blit(row_1_img, (self.title_rect.left, self.title_rect.bottom + 5))
        SCREEN.blit(row_2_img, (self.title_rect.left, self.title_rect.bottom + 20))
        SCREEN.blit(row_3_img, (self.title_rect.left, self.title_rect.bottom + 35))


# Class for countdown timer
class CountdownTimer:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.time = TIME_MAX  # An object of class datetime.datetime

        self.font_title = pygame.font.SysFont('Arial', 16, bold=True)
        self.font_body = pygame.font.SysFont('Arial', 16)

        self.title_img = self.font_title.render('Time left:', True, HOUSE_MARBLE)
        self.title_rect = self.title_img.get_rect()
        self.title_rect.topleft = (self.x, self.y)

        # If number of seconds = 0, render two zeroes
        if self.time.second == 0:
            self.timer_string = str(self.time.minute) + ':' + str(self.time.second) + '0'
        # Elif seconds is a single digit number, append a 0 to the front
        elif len(str(self.time.second)) == 1:
            self.timer_string = str(self.time.minute) + ':' + '0' + str(self.time.second)
        else:
            self.timer_string = str(self.time.minute) + ':' + str(self.time.second)

        self.timer_img = self.font_body.render(self.timer_string, True, HOUSE_MARBLE)
        self.timer_rect = self.timer_img.get_rect()
        self.timer_rect.topleft = (self.title_rect.left, self.title_rect.top + 20)

    # Function to update the time value
    def update(self):
        # When function is called, subtract one second from the remaining time
        self.time = self.time - datetime.timedelta(seconds=1)

        # Then update the counter image
        if self.time.second == 0:
            self.timer_string = str(self.time.minute) + ':' + str(self.time.second) + '0'
        elif len(str(self.time.second)) == 1:
            self.timer_string = str(self.time.minute) + ':' + '0' + str(self.time.second)
        else:
            self.timer_string = str(self.time.minute) + ':' + str(self.time.second)

        self.timer_img = self.font_body.render(self.timer_string, True, HOUSE_MARBLE)
        self.timer_rect = self.timer_img.get_rect()
        self.timer_rect.topleft = (self.title_rect.left, self.title_rect.top + 20)

    # Function to draw the counter
    def draw(self):
        SCREEN.blit(self.title_img, self.title_rect.topleft)
        SCREEN.blit(self.timer_img, self.timer_rect.topleft)


# Function to parse "block type" strings
def parse_block_type(block_type):
    # Initialize variables
    block_owner_id = None
    block_metadata = None

    # Extract the class identifier (G, H, P, or W)
    block_class = block_type[0]

    # If length of string >1, Extract the rest of the string
    if len(block_type) > 1:
        rest_of_string = block_type[1:len(block_type)]

        # Define owner_id and block_metadata based on string properties
        if len(rest_of_string) == 1:
            block_owner_id = int(rest_of_string)
            block_metadata = 0

        elif len(rest_of_string) == 2:
            # E.g. '12'
            if rest_of_string[0].isdigit() and rest_of_string[1].isdigit():
                block_owner_id = int(rest_of_string)
                block_metadata = 0
            # E.g. 1r
            else:
                block_owner_id = int(rest_of_string[0])
                block_metadata = rest_of_string[1]

        elif len(rest_of_string) == 3:
            # E.g. 14r
            if rest_of_string[1].isdigit():
                block_owner_id = int(rest_of_string[0:2])
                block_metadata = rest_of_string[2]
            # E.g. 4rt
            else:
                block_owner_id = int(rest_of_string[0])
                block_metadata = rest_of_string[1:3]

        elif len(rest_of_string) == 4:
            block_owner_id = int(rest_of_string[0:2])
            block_metadata = rest_of_string[2:4]

    # Else (len(block_type) == 1)
    else:
        block_owner_id = 0
        block_metadata = 0

    # Return the result as a tuple
    return block_class, block_metadata, block_owner_id


# END OF SETUP


# Function to initialize game world and then run the game loop
def run_game():
    # Render the game world in initial state
    # Initialize a dictionary to store all blocks in the world (key = block_id)
    global blocks_dict
    blocks_dict = {}

    # Initialize a list to store the rect objects associated with each block (index = block_id)
    global rects_list
    rects_list = []

    # Initialize a list to store the rects associated with all fence and house objects
    global collider_list
    collider_list = []

    # Initialize a list to store all blocks where food items can appear
    global food_blocks_list
    food_blocks_list = []

    # Initialize a list to store all food objects
    global food_list
    food_list = []

    # Initialize a list to store the rects associated with all food objects
    global food_rects_list
    food_rects_list = []

    # Initialize a list to store all water blocks
    global water_blocks_list
    water_blocks_list = []

    # Initialize a list to store the rects associated with all water blocks
    global water_rects_list
    water_rects_list = []

    # Create dataframe containing block type string for each block
    # Access using block_types.iloc[row, column]
    block_types = pd.read_csv('MapBlockIDs.csv', sep=',', header=None)

    # Create/render each of the objects specified in block_types, give it a block id, and add it to blocks_dict
    current_block_id = 0
    for row_index in range(NUM_ROW):
        for col_index in range(NUM_COLUMN):

            # Get string denoting current block type, and parse to get class and metadata for current block
            current_type_str = block_types.iloc[row_index, col_index]
            current_block_info = parse_block_type(current_type_str)

            # If the block's class is pavement,
            if current_block_info[0] == 'P':
                # Create a new pavement block at location dependent on current row and column index
                new_block = BlockPavement(
                    x=COLUMN_WIDTH * col_index,
                    y=ROW_HEIGHT * row_index,
                    owner_id=0,  # Owner id for all pavement blocks = 0
                    block_id=current_block_id
                )
                # Append new block to rects_list and blocks_dict
                rects_list.append(new_block.rect)
                blocks_dict[current_block_id] = new_block
                # Render out the new block
                new_block.draw()

            # Elif the block's class is house
            elif current_block_info[0] == 'H':
                # Create a new house block at location dependent on current row and column index
                new_block = BlockHouse(
                    x=COLUMN_WIDTH * col_index,
                    y=ROW_HEIGHT * row_index,
                    color='marble',
                    block_id=current_block_id
                )
                # Append new block to rects_list and blocks_dict
                rects_list.append(new_block.rect)
                blocks_dict[current_block_id] = new_block
                # Render out the new block
                new_block.draw()

            # Elif the block's class is water
            elif current_block_info[0] == 'W':
                # Create a new water block at location dependent on current row and column index
                new_block = BlockWater(
                    x=COLUMN_WIDTH * col_index,
                    y=ROW_HEIGHT * row_index,
                    owner_id=0,  # Owner id for all water blocks is 0
                    block_id=current_block_id
                )
                # Append new block to rects_list and blocks_dict (and other appropriate lists)
                rects_list.append(new_block.rect)
                blocks_dict[current_block_id] = new_block
                water_blocks_list.append(new_block)
                water_rects_list.append(new_block.rect)
                # Render out the new block
                new_block.draw()

            # Else (block's class is grass)
            else:
                # If metadata is 'l', create/render/store grass block with fence on left
                if current_block_info[1] == 'l':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_left=True
                    )
                    # Append new block to appropriate lists/dicts
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 'r', create/render/store grass block with fence on right
                elif current_block_info[1] == 'r':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_right=True
                    )
                    # Append new block to appropriate lists/dicts
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 't', create/render/store grass block with fence on top
                elif current_block_info[1] == 't':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_top=True
                    )
                    # Append new block to appropriate lists/dicts
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 'b', create/render/store grass block with fence on bottom
                elif current_block_info[1] == 'b':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_bottom=True
                    )
                    # Append new block to rects_list and blocks_dict
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 'lt', create/render/store grass block with fence on left and top
                elif current_block_info[1] == 'lt':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_left=True,
                        fence_top=True
                    )
                    # Append new block to rects_list and blocks_dict
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 'lb' create/render/store grass block with fence on left and bottom
                elif current_block_info[1] == 'lb':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_left=True,
                        fence_bottom=True
                    )
                    # Append new block to rects_list and blocks_dict
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 'rt' create/render/store grass block with fence on right and top
                elif current_block_info[1] == 'rt':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_right=True,
                        fence_top=True
                    )
                    # Append new block to rects_list and blocks_dict
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # If metadata is 'rb' create/render/store grass block with fence on right and bottom
                elif current_block_info[1] == 'rb':
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id,
                        fence_right=True,
                        fence_bottom=True
                    )
                    # Append new block to rects_list and blocks_dict
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw(first_draw=True)

                # Else (no fences), create/render/store grass block with the specified owner id
                else:
                    new_block = BlockGrass(
                        x=COLUMN_WIDTH * col_index,
                        y=ROW_HEIGHT * row_index,
                        owner_id=current_block_info[2],
                        block_id=current_block_id
                    )
                    # Append new block to rects_list and blocks_dict
                    rects_list.append(new_block.rect)
                    blocks_dict[current_block_id] = new_block
                    food_blocks_list.append(new_block)
                    # Render out the new block
                    new_block.draw()

            # Increment current block id
            current_block_id += 1

    # Create player sprite and add to a group
    player_1 = Player()
    player_group = pygame.sprite.Group()
    player_group.add(player_1)

    # Generate owner objects with the properties specified in OwnerProperties.csv
    # Read in owner properties
    global owner_info
    owner_info = pd.read_csv('OwnerProperties.csv')

    # Initialize owners list
    global owners_list
    owners_list = []

    # Create each owner object and append to owners_list
    for row_index in range(20):
        new_owner = Owner(
            owner_id=owner_info.iloc[row_index, 0],
            affection=owner_info.iloc[row_index, 1],
            sensitivity=owner_info.iloc[row_index, 2],
            treat_rate_base=owner_info.iloc[row_index, 3]
        )
        owners_list.append(new_owner)

    # Create dictionary of block id's at which to display affection counters (owner_id: block_id)
    affection_counter_block_ids = {
        1: 342,
        2: 70,
        3: 74,
        4: 78,
        5: 82,
        6: 86,
        7: 382,
        8: 373,
        9: 363,
        10: 816,
        11: 777,
        12: 785,
        13: 795,
        14: 804,
        15: 862,
        16: 1190,
        17: 1181,
        18: 1170,
        19: 1154
    }

    # Initialize dictionary to store all affection counter objects (owner_id: affection_counter)
    global affection_counter_dict
    affection_counter_dict = {}

    # Initialize list to store the rects associated with all affection counter objects
    global affection_counter_rects
    affection_counter_rects = []

    # Create affection counters at each specified block id
    for item in affection_counter_block_ids.items():
        current_owner_id = item[0]
        current_block_id = item[1]

        # Get coordinates of the center of the current block
        current_coords = blocks_dict.get(current_block_id).rect.center

        # Get starting affection value of current owner
        current_affection = owners_list[current_owner_id].affection

        # Create new affection counter at specified location
        new_counter = AffectionCounter(current_owner_id, current_affection, current_coords[0], current_coords[1])

        # Add the counter to appropriate dicts/lists
        affection_counter_dict[current_owner_id] = new_counter

    # Create status bars
    food_status = StatusBar("Food", (2 * COLUMN_WIDTH, 26 * ROW_HEIGHT + 10, player_1.food * STATUS_BAR_SCALE, 20),
                            FOOD)
    water_status = StatusBar("Water", (24 * COLUMN_WIDTH, 26 * ROW_HEIGHT + 10, player_1.water * STATUS_BAR_SCALE, 20),
                             WATER)
    poop_status = StatusBar('Poop', (2 * COLUMN_WIDTH, 26 * ROW_HEIGHT + 60, player_1.poop * STATUS_BAR_SCALE, 20),
                            POOP)
    pee_status = StatusBar("Pee", (24 * COLUMN_WIDTH, 26 * ROW_HEIGHT + 60, player_1.pee * STATUS_BAR_SCALE, 20), PEE)

    # Create status bar background rect
    status_bar_background = pygame.Rect((0, 26 * ROW_HEIGHT, WINDOW_WIDTH, STATUS_HEIGHT))

    # Create a block status counter
    block_status_counter = BlockStatusCounter(45 * COLUMN_WIDTH, 26 * ROW_HEIGHT + 10)

    # Create a timer
    countdown_timer = CountdownTimer(0.25 * COLUMN_WIDTH, 26 * ROW_HEIGHT + 10)

    # Update display to render the full map
    pygame.display.update()

    # Initialize variables to track current movement direction
    moving_left = False
    moving_right = False
    moving_down = False
    moving_up = False

    # Initialize variables to track current player behaviors
    player_drinking = False
    player_pooping = False
    player_peeing = False
    player_tricking = False

    # Initialize variable to track timer updates
    frames_since_timer_update = 0

    # Initialize a variable to track reason for game over
    global game_over_reason

    # Game loop
    running = True

    while running:

        # If any "game over" conditions are met, end the gameplay loop
        if countdown_timer.time.minute == 0 and countdown_timer.time.second == 0:
            running = False
            game_over_reason = "Time"
        if player_1.food <= 0:
            running = False
            game_over_reason = "Food"
        if player_1.water <= 0:
            running = False
            game_over_reason = "Water"

        # Set dirty_rects list to empty
        dirty_rects = []

        # Get input events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_a:
                    # Stop moving up or down
                    player_1.stop_move('y')
                    moving_up = False
                    moving_down = False
                    # Start moving to the left
                    player_1.start_move('left')
                    moving_left = True

                if event.key == pygame.K_d:
                    # Stop moving up or down
                    player_1.stop_move('y')
                    moving_up = False
                    moving_down = False
                    # Start moving to the right
                    player_1.start_move('right')
                    moving_right = True

                if event.key == pygame.K_s:
                    # Stop moving to the left or right
                    player_1.stop_move('x')
                    moving_left = False
                    moving_right = False
                    # Start moving down
                    player_1.start_move('down')
                    moving_down = True

                if event.key == pygame.K_w:
                    # Stop moving to the left or right
                    player_1.stop_move('x')
                    moving_left = False
                    moving_right = False
                    # Start moving up
                    player_1.start_move('up')
                    moving_up = True

                if event.key == pygame.K_q:
                    player_drinking = True

                if event.key == pygame.K_e:
                    # If pooping, stop pooping and start tricking
                    if player_pooping:
                        player_pooping = False
                        player_tricking = True
                    # If peeing stop peeing and start tricking
                    elif player_peeing:
                        player_peeing = False
                        player_tricking = True
                    else:
                        player_tricking = True

                if event.key == pygame.K_c:
                    # If peeing, stop peeing and start pooping
                    if player_peeing:
                        player_peeing = False
                        player_pooping = True
                    # Elif tricking, stop tricking and start pooping
                    elif player_tricking:
                        player_tricking = False
                        player_pooping = True
                    else:
                        player_pooping = True

                if event.key == pygame.K_z:
                    # If pooping, stop pooping and start peeing
                    if player_pooping:
                        player_pooping = False
                        player_peeing = True
                    # Elif tricking, stop tricking and start peeing
                    elif player_tricking:
                        player_tricking = False
                        player_peeing = True
                    else:
                        player_peeing = True

            if event.type == pygame.KEYUP:
                if event.key == pygame.K_a:
                    player_1.stop_move('x')
                    moving_left = False
                if event.key == pygame.K_d:
                    player_1.stop_move('x')
                    moving_right = False
                if event.key == pygame.K_s:
                    player_1.stop_move('y')
                    moving_down = False
                if event.key == pygame.K_w:
                    player_1.stop_move('y')
                    moving_up = False
                if event.key == pygame.K_q:
                    player_drinking = False
                if event.key == pygame.K_e:
                    player_tricking = False
                if event.key == pygame.K_c:
                    player_pooping = False
                if event.key == pygame.K_z:
                    player_peeing = False

        # Update the food status of each block that can potentially contain food
        for block in food_blocks_list:
            # If no food currently present, check to see if more food should be added, based on block owner's treat rate
            if not block.food_present:
                current_owner = owners_list[block.owner_id]
                block.dispense_food(current_owner.treat_rate_active)

        # Draw all food items to the screen
        for food_item in food_list:
            food_item.draw()

        # Add all blocks containing food items to dirty rects
        dirty_rects.extend(food_rects_list)

        # Get any block(s) the player is currently occupying and append to dirty_rects
        player_start_block_ids = player_1.rect.collidelistall(rects_list)
        for id_val in player_start_block_ids:
            current_rect = blocks_dict.get(id_val).rect
            dirty_rects.append(current_rect)

        # Blit these blocks to the screen
        for id_val in player_start_block_ids:
            blocks_dict.get(id_val).draw()

        # Get the block object the player is currently occupying
        current_block = blocks_dict.get(player_start_block_ids[0])

        # If the player is in a block with a food item, update player food inventory and destroy food item
        if current_block.food_present:
            # Get the index of the food item the player is colliding with
            current_food_index = player_1.rect.collidelist(food_rects_list)
            # Pull the current food item out of the two food lists
            current_food = food_list.pop(current_food_index)
            food_rects_list.pop(current_food_index)
            # Add the value of the current food to the player's food inventory
            player_1.food += current_food.food_value
            # Set food_present = false for the current block
            current_block.food_present = False

        # Update player water inventory based on heat of the current block
        player_1.take_heat(current_block.heat)

        # If the player is drinking, increment their water inventory
        if player_drinking:
            player_1.drink()

        # If player is attempting to poop, has nonzero poop, and is in a grass block...
        if player_pooping and player_1.poop > 1 and current_block.block_type == 'grass':
            # ...and the block has space, update current block and its owner
            if current_block.dirt + POOP_RATE <= POOP_MAX:
                player_1.release_poop()
                current_block.accept_poop()
                owners_list[current_block.owner_id].update('poop')

        # If player is attempting to pee, has nonzero pee, and is in a grass block...
        if player_peeing and player_1.pee > 1 and current_block.block_type == 'grass':
            # ...and the block has space, update current block and its owner
            if current_block.destruction + PEE_RATE <= PEE_MAX:
                player_1.release_pee()
                current_block.accept_pee()
                owners_list[current_block.owner_id].update('pee')

        # If player is attempting to trick, is in a grass block, and has necessary resources, then update the block's owner
        if player_tricking and current_block.block_type == 'grass':
            if player_1.food - TRICK_COST > 0 and player_1.water - TRICK_COST > 0:
                player_1.do_trick()
                owners_list[current_block.owner_id].update('trick')

        # Update player sprite properties for the next frame
        player_group.update()

        # Get rects associated with the new block(s) the player will be occupying and append to dirty_rects
        player_end_block_ids = player_1.rect.collidelistall(rects_list)
        for id_val in player_end_block_ids:
            current_rect = blocks_dict.get(id_val).rect
            dirty_rects.append(current_rect)

        # Blit player sprite to the screen in updated location
        player_group.draw(SCREEN)

        # Blit status bar background
        pygame.draw.rect(SCREEN, (0, 0, 0), status_bar_background)

        # Update the status bars
        food_status.update(player_1.food * STATUS_BAR_SCALE)
        water_status.update(player_1.water * STATUS_BAR_SCALE)
        poop_status.update(player_1.poop * STATUS_BAR_SCALE)
        pee_status.update(player_1.pee * STATUS_BAR_SCALE)

        # Render the status bars
        food_status.draw()
        water_status.draw()
        poop_status.draw()
        pee_status.draw()

        # Add status bars and background to dirty_rects
        dirty_rects.append(status_bar_background)
        dirty_rects.extend([food_status.rect, food_status.label_rect])
        dirty_rects.extend([water_status.rect, water_status.label_rect])
        dirty_rects.extend([poop_status.rect, poop_status.label_rect])
        dirty_rects.extend([pee_status.rect, pee_status.label_rect])

        # Re-draw all blocks where affection counters are positioned (affection_counter_block_ids)
        for block_id in affection_counter_block_ids.values():
            temp_block = blocks_dict.get(block_id)
            temp_block.draw()

        # Update all affection counters to display current affection values for the associated owners, and draw
        for affection_counter in affection_counter_dict.values():
            affection_counter.update(owners_list[affection_counter.owner_id].affection)
            affection_counter.draw()
            # Append the current rect to dirty rects
            dirty_rects.append(affection_counter.rect)

        # If FPS frames have elapsed since timer was last updated, update the timer, draw, and append to dirty_rects
        if frames_since_timer_update == FPS:
            countdown_timer.update()
            countdown_timer.draw()
            frames_since_timer_update = 0
        # Else, draw the timer as is and increment frames since last update
        else:
            countdown_timer.draw()
            frames_since_timer_update += 1

        # Update and draw the block status counter
        block_status_counter.update(current_block)
        block_status_counter.draw()

        # Update the dirty rects
        pygame.display.update(dirty_rects)

        clock.tick(FPS)


# Menus
# Instructions submenu
instructions_menu = pygame_menu.Menu("How to Play", 800, 600,
                                     theme=pygame_menu.themes.THEME_DARK)
instructions_text = "Test text here"\
                    "more text here"
# TODO: Create images (annotated screenshots/keymappings) and associated text, and add to this menu

instructions_menu.add.label(instructions_text, font_size = 16)

# Options submenu
options_menu = pygame_menu.Menu("Options", 800, 600,
                                theme=pygame_menu.themes.THEME_DARK)

# Credits submenu
credits_menu = pygame_menu.Menu("Credits", 800, 600,
                                theme=pygame_menu.themes.THEME_DARK)

# Start menu
start_menu = pygame_menu.Menu("Husky Simulator", 800, 600,
                              theme=pygame_menu.themes.THEME_DARK)
start_menu.add.button("Start", run_game)
start_menu.add.button("How to Play", instructions_menu)
start_menu.add.button("Options", options_menu)
start_menu.add.button("Credits", credits_menu)
start_menu.add.button("Quit", pygame_menu.events.EXIT)
start_menu.mainloop(SCREEN)


