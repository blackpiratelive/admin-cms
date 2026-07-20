package com.personal.cms.journal.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

enum class JournalScreen(val route: String, val title: String, val icon: ImageVector) {
    Dashboard("dashboard", "Dashboard", Icons.Default.Dashboard),
    Entries("entries", "Journal", Icons.Default.Book),
    Timeline("timeline", "Timeline", Icons.Default.Timeline),
    Calendar("calendar", "Calendar", Icons.Default.CalendarMonth),
    Settings("settings", "Settings", Icons.Default.Settings)
}

@Composable
fun AdaptiveNavigationContainer(
    currentScreen: JournalScreen,
    onNavigate: (JournalScreen) -> Unit,
    isExpandedScreen: Boolean,
    content: @Composable () -> Unit
) {
    if (isExpandedScreen) {
        Row(modifier = Modifier.fillMaxSize()) {
            NavigationRail(
                modifier = Modifier.fillMaxHeight().width(96.dp),
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurfaceVariant
            ) {
                Spacer(modifier = Modifier.height(32.dp))
                JournalScreen.values().forEach { screen ->
                    NavigationRailItem(
                        selected = currentScreen == screen,
                        onClick = { onNavigate(screen) },
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        alwaysShowLabel = false,
                        colors = NavigationRailItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
            content()
        }
    } else {
        Scaffold(
            bottomBar = {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    JournalScreen.values().forEach { screen ->
                        NavigationBarItem(
                            selected = currentScreen == screen,
                            onClick = { onNavigate(screen) },
                            icon = { Icon(screen.icon, contentDescription = screen.title) },
                            label = { Text(screen.title) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                indicatorColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        )
                    }
                }
            }
        ) { paddingValues ->
            Surface(modifier = Modifier.padding(paddingValues)) {
                content()
            }
        }
    }
}
